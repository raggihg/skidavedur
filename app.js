const stations = [
  { id: 2636, name: 'Þverfjall', height: 'fjall', url: 'https://gottvedur.is/vedur/athuganir/2636/' },
  { id: 2641, name: 'Seljalandsdalur · skíðaskáli', height: '283 m', url: 'https://gottvedur.is/vedur/athuganir/2641/' },
  { id: 2644, name: 'Ísafjörður · Tungudalur', height: '4 m', url: 'https://gottvedur.is/vedur/athuganir/2644/' }
];

const fallback = stations.map(s => ({station_id:s.id, t:null, f:null, d:null, fx:null, rh:null, time:null}));

const $ = (sel) => document.querySelector(sel);
const stationGrid = $('#station-grid');
const updated = $('#updated');
const skiScore = $('#ski-score');
const skiNote = $('#ski-note');

function fmt(v, unit='') { return v === null || v === undefined || v === -99 || Number.isNaN(v) ? '—' : `${String(v).replace('.', ',')}${unit}`; }

function windCompass(deg) {
  if (deg === null || deg === undefined || deg === '—') return '—';
  if (typeof deg === 'string' && Number.isNaN(Number(deg))) return deg;
  const d = ((Number(deg) % 360) + 360) % 360;
  const dirs = ['N','NA','A','SA','S','SV','V','NV'];
  return dirs[Math.round(d / 45) % 8];
}

function windArrow(direction) {
  const deg = Number(direction);
  if (!Number.isFinite(deg)) return '<span class="wind-arrow muted">•</span>';
  return `<span class="wind-arrow" style="--wind-deg:${deg}deg" title="Vindátt ${Math.round(deg)}°">↑</span>`;
}

function windLine(direction, speed) {
  const deg = Number(direction);
  const compass = windCompass(direction);
  const degrees = Number.isFinite(deg) ? `${Math.round(deg)}°` : '—';
  return `${windArrow(direction)} <span>${compass} · ${degrees} · ${fmt(speed, ' m/s')}</span>`;
}

function renderStations(rows) {
  stationGrid.innerHTML = stations.map(s => {
    const r = rows.find(x => Number(x.station_id || x.station || x.stationId) === s.id) || {};
    const temp = r.t ?? r.T ?? r.temperature;
    const wind = r.f ?? r.F ?? r.wind_speed;
    const gust = r.fx ?? r.FX ?? r.wind_gust;
    const hum = r.rh ?? r.RH ?? r.humidity;
    const direction = r.d ?? r.D ?? r.wind_direction;
    return `<article class="card">
      <h3>${s.name}</h3>
      <div class="station-meta">Stöð ${s.id} · ${s.height}</div>
      <div class="metric"><span>Hiti</span><strong>${fmt(temp, '°C')}</strong></div>
      <div class="metric wind-metric"><span>Vindur</span><strong>${windLine(direction, wind)}</strong></div>
      <div class="metric"><span>Hviða</span><strong>${fmt(gust, ' m/s')}</strong></div>
      <div class="metric"><span>Raki</span><strong>${fmt(hum, '%')}</strong></div>
      <a class="open" href="${s.url}" target="_blank" rel="noopener">Opna frumgögn →</a>
    </article>`;
  }).join('');

  const temps = rows.map(r => Number(r.t ?? r.T ?? r.temperature)).filter(Number.isFinite);
  const winds = rows.map(r => Number(r.f ?? r.F ?? r.wind_speed)).filter(Number.isFinite);
  const gusts = rows.map(r => Number(r.fx ?? r.FX ?? r.wind_gust)).filter(Number.isFinite);
  if (temps.length || winds.length || gusts.length) {
    const avgTemp = temps.length ? temps.reduce((a,b)=>a+b,0) / temps.length : null;
    const maxWind = winds.length ? Math.max(...winds) : 0;
    const maxGust = gusts.length ? Math.max(...gusts) : 0;
    skiScore.textContent = maxGust >= 25 ? 'Mjög varasamar hviður' : maxWind >= 18 ? 'Hvassviðri á fjalli' : avgTemp !== null && avgTemp <= 1 && maxWind < 14 ? 'Gott skíðaveður mögulegt' : 'Fylgjast vel með';
    skiNote.textContent = avgTemp !== null && avgTemp > 2 ? 'Hlýindi geta haft áhrif á snjó og snjóflóðahættu.' : 'Skoðaðu vindátt, hviður, viðvaranir og snjóflóðaspá áður en farið er.';
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
    const rows = data.filter(r => stations.some(s => Number(r.station_id || r.station || r.stationId) === s.id));
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
      <span class="pill">úrkoma ${fmt(d.precipitation_sum[i], ' mm')}</span>
      <span class="pill">snjór ${fmt(d.snowfall_sum[i], ' cm')}</span>
      <span class="pill">vindur ${fmt(d.wind_speed_10m_max[i], ' m/s')}</span>
      <span class="pill">hviður ${fmt(d.wind_gusts_10m_max[i], ' m/s')}</span>
    </div>`).join('');
  } catch(e) {
    el.textContent = 'Ekki náðist að sækja spá. Opnaðu hlekkina í spá Veðurstofunnar.';
  }
}

function warningLevelClass(severity = '') {
  const s = String(severity).toLowerCase();
  if (s.includes('extreme') || s.includes('red')) return 'red';
  if (s.includes('severe') || s.includes('orange')) return 'orange';
  if (s.includes('moderate') || s.includes('yellow')) return 'yellow';
  return 'green';
}

function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function capInfos(item) { return asArray(item.info || item.infos || item.cap?.info || item.alert?.info); }
function capAreas(info) { return asArray(info.area || info.areas); }
function textFrom(v) { return typeof v === 'string' ? v : (v?.text || v?.value || ''); }

function warningMatches(info) {
  const areaText = capAreas(info).map(a => [a.areaDesc, a.area, a.name].map(textFrom).join(' ')).join(' ');
  const combined = `${areaText} ${info.headline || ''} ${info.description || ''} ${info.event || ''}`.toLowerCase();
  return combined.includes('vestfir') || combined.includes('westfj') || combined.includes('norðanverð') || combined.includes('isafj') || combined.includes('ísafj') || combined.includes('djúp');
}

async function loadWarnings() {
  const el = $('#warnings-list');
  try {
    const res = await fetch('https://api.vedur.is/cap/v1/capbroker/active/detailed/all/');
    if (!res.ok) throw new Error('CAP API svaraði ekki');
    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.alerts || json.items || json.data || json.results || []);
    const warnings = [];
    items.forEach(item => capInfos(item).forEach(info => {
      if (warningMatches(info)) warnings.push({ item, info });
    }));

    if (!warnings.length) {
      el.innerHTML = `<div class="warning ok"><strong>Engar virkar viðvaranir fundust fyrir Vestfirði.</strong><span>Skoðaðu samt frumheimild áður en farið er á fjall.</span></div>`;
      return;
    }

    el.innerHTML = warnings.map(({info}) => {
      const cls = warningLevelClass(info.severity || info.certainty || info.urgency);
      const headline = info.headline || info.event || 'Veðurviðvörun';
      const desc = info.description || info.instruction || '';
      const onset = info.onset ? new Date(info.onset).toLocaleString('is-IS', {dateStyle:'short', timeStyle:'short'}) : '';
      const expires = info.expires ? new Date(info.expires).toLocaleString('is-IS', {dateStyle:'short', timeStyle:'short'}) : '';
      return `<article class="warning ${cls}">
        <strong>${headline}</strong>
        <span>${onset || expires ? `${onset}${expires ? ' – ' + expires : ''}` : 'Tími ekki gefinn'}</span>
        ${desc ? `<p>${desc}</p>` : ''}
      </article>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="warning"><strong>Ekki náðist að sækja viðvaranir sjálfvirkt.</strong><span>Opnaðu viðvaranir Veðurstofunnar með hlekknum hér fyrir neðan.</span></div>`;
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
loadWarnings();
