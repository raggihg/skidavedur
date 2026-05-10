const stations = [
  { id: 2636, name: 'Þverfjall', height: 'fjall', url: 'https://gottvedur.is/vedur/athuganir/2636/' },
  { id: 2640, name: 'Seljalandsdalur', height: '550 m', url: 'https://gottvedur.is/vedur/athuganir/2640/' },
  { id: 2641, name: 'Seljalandsdalur · skíðaskáli', height: '283 m', url: 'https://gottvedur.is/vedur/athuganir/2641/' },
  { id: 2644, name: 'Ísafjörður · Tungudalur', height: '4 m', url: 'https://gottvedur.is/vedur/athuganir/2644/' }
];

const fallback = [
  {station_id:2636, t:null, f:null, d:null, fx:null, rh:null, time:null},
  {station_id:2640, t:null, f:null, d:null, fx:null, rh:null, time:null},
  {station_id:2641, t:null, f:null, d:null, fx:null, rh:null, time:null},
  {station_id:2644, t:null, f:null, d:null, fx:null, rh:null, time:null}
];

const $ = (sel) => document.querySelector(sel);
const stationGrid = $('#station-grid');
const updated = $('#updated');
const skiScore = $('#ski-score');
const skiNote = $('#ski-note');

function fmt(v, unit='') { return v === null || v === undefined || v === -99 ? '—' : `${String(v).replace('.', ',')}${unit}`; }
function dir(d) { return d ?? '—'; }

function renderStations(rows) {
  stationGrid.innerHTML = stations.map(s => {
    const r = rows.find(x => Number(x.station_id || x.station) === s.id) || {};
    const temp = r.t ?? r.T ?? r.temperature;
    const wind = r.f ?? r.F ?? r.wind_speed;
    const gust = r.fx ?? r.FX ?? r.wind_gust;
    const hum = r.rh ?? r.RH ?? r.humidity;
    const direction = r.d ?? r.D ?? r.wind_direction;
    return `<article class="card">
      <h3>${s.name}</h3>
      <div class="station-meta">Stöð ${s.id} · ${s.height}</div>
      <div class="metric"><span>Hiti</span><strong>${fmt(temp, '°C')}</strong></div>
      <div class="metric"><span>Vindur</span><strong>${dir(direction)} ${fmt(wind, ' m/s')}</strong></div>
      <div class="metric"><span>Hviða</span><strong>${fmt(gust, ' m/s')}</strong></div>
      <div class="metric"><span>Raki</span><strong>${fmt(hum, '%')}</strong></div>
      <a class="open" href="${s.url}" target="_blank" rel="noopener">Opna frumgögn →</a>
    </article>`;
  }).join('');

  const temps = rows.map(r => Number(r.t ?? r.T ?? r.temperature)).filter(Number.isFinite);
  const winds = rows.map(r => Number(r.f ?? r.F ?? r.wind_speed)).filter(Number.isFinite);
  if (temps.length || winds.length) {
    const avgTemp = temps.reduce((a,b)=>a+b,0) / temps.length;
    const maxWind = Math.max(...winds, 0);
    skiScore.textContent = avgTemp <= 1 && maxWind < 14 ? 'Gott skíðaveður mögulegt' : maxWind >= 18 ? 'Hvassviðri á fjalli' : 'Fylgjast vel með';
    skiNote.textContent = avgTemp > 2 ? 'Hlýindi geta haft áhrif á snjó og snjóflóðahættu.' : 'Skoðaðu vind, hviður og snjóflóðaspá áður en farið er.';
  } else {
    skiScore.textContent = 'Skoða frumheimildir';
    skiNote.textContent = 'Live gögn birtust ekki í vafra; notaðu hlekkina í stöðvarnar.';
  }
}

async function loadStations() {
  try {
    const res = await fetch('https://api.vedur.is/weather/observations/aws/hour/latest?parameters=basic');
    if (!res.ok) throw new Error('IMO API svaraði ekki');
    const json = await res.json();
    const data = Array.isArray(json) ? json : (json.data || json.results || json.observations || []);
    const rows = data.filter(r => stations.some(s => Number(r.station_id || r.station) === s.id));
    renderStations(rows.length ? rows : fallback);
    updated.textContent = new Date().toLocaleString('is-IS', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    renderStations(fallback);
    updated.textContent = 'Ekki náðist að sækja live gögn';
  }
}

function weatherText(code){
  const map = {0:'Heiðskírt',1:'Léttskýjað',2:'Hálfskýjað',3:'Alskýjað',45:'Þoka',48:'Hrímþoka',51:'Úði',53:'Úði',55:'Mikill úði',61:'Rigning',63:'Rigning',65:'Mikil rigning',71:'Snjókoma',73:'Snjókoma',75:'Mikil snjókoma',80:'Skúrir',81:'Skúrir',82:'Miklar skúrir',85:'Él',86:'Mikil él',95:'Þrumur'};
  return map[code] || 'Veður';
}

async function loadForecast() {
  const el = $('#forecast-list');
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=66.067&longitude=-23.214&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=Atlantic%2FReykjavik&wind_speed_unit=ms';
    const res = await fetch(url);
    const json = await res.json();
    const d = json.daily;
    el.innerHTML = d.time.slice(0,7).map((date, i) => `<div class="forecast-day">
      <strong>${new Date(date + 'T12:00:00').toLocaleDateString('is-IS', { weekday:'short', day:'numeric', month:'short' })}</strong>
      <span class="pill">${weatherText(d.weather_code[i])}</span>
      <span class="pill">${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C</span>
      <span class="pill">${fmt(d.precipitation_sum[i], ' mm')}</span>
      <span class="pill">vindur ${fmt(d.wind_speed_10m_max[i], ' m/s')}</span>
    </div>`).join('');
  } catch(e) {
    el.textContent = 'Ekki náðist að sækja spá. Opnaðu hlekkina í spá Veðurstofunnar.';
  }
}

function setWindy(lat, lon, zoom) {
  $('#windy').src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf&marker=true&message=true&metricWind=m%2Fs&metricTemp=%C2%B0C&metricRain=mm&type=map`;
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  setWindy(btn.dataset.lat, btn.dataset.lon, btn.dataset.zoom);
}));

setWindy(66.067, -23.214, 11);
loadStations();
loadForecast();
