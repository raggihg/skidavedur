const IMO_STATIONS = [
  { id: '2636', name: 'Þverfjall', source: 'Veðurstofan' },
  { id: '2641', name: 'Seljalandsdalur – skíðaskáli', source: 'Veðurstofan' },
  { id: '2644', name: 'Tungudalur', source: 'Veðurstofan' },
];
const WINDY_STATIONS = [
  { id: 'pws-f046eee0', name: 'Nónvatn', source: 'Windy PWS' },
  { id: 'pws-2f046eee0', name: 'Heiðin', source: 'Windy PWS' },
  { id: 'pws-1f046eee0', name: 'Miðfellsháls', source: 'Windy PWS' },
];
const labels = ['Staður','Uppfært','Hiti','Vindur','Hviður','Átt','Úrkoma','Raki','Þrýst.'];
const $ = (id) => document.getElementById(id);
const fmtTime = (d) => d ? new Intl.DateTimeFormat('is-IS',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d)) : '—';
const fmt = (v, unit='') => Number.isFinite(Number(v)) ? `${Number(v).toFixed(unit==='°C'?1:0)}${unit}` : '—';
function windArrowToward(degFrom){
  if(!Number.isFinite(Number(degFrom))) return '—';
  const toward = (Number(degFrom)+180)%360;
  return `<span class="wind-arrow" title="Vindur fer í þessa átt" style="transform:rotate(${toward}deg)">↑</span>`;
}
function setClock(){ $('nowClock').textContent = fmtTime(Date.now()); }
setInterval(setClock, 1000); setClock();
async function getJSON(url){ const r = await fetch(url); const text = await r.text(); if(!r.ok) throw new Error(`${r.status} ${url}`); try{return JSON.parse(text)}catch{return {ok:false,error:'Ekki JSON',raw:text.slice(0,200)}} }
function normalizeIMO(payload){
  if (Array.isArray(payload?.rows)) return payload.rows;
  const rows = Array.isArray(payload?.stations) ? payload.stations : Array.isArray(payload) ? payload : [];
  return IMO_STATIONS.map(st => {
    const raw = rows.find(x => String(x.station_id||x.stationId||x.id||x.station) === st.id) || {};
    const obs = raw.observations?.[0] || raw.data?.[0] || raw;
    return { ...st, time: obs.time || obs.date || obs.timestamp || raw.time, temp: obs.T ?? obs.temp ?? obs.temperature, wind: obs.F ?? obs.wind_speed ?? obs.windSpeed, gust: obs.FX ?? obs.gust ?? obs.wind_gust, dir: obs.D ?? obs.wind_direction ?? obs.windDirection, precip: obs.R ?? obs.precipitation, humidity: obs.RH ?? obs.humidity, pressure: obs.P ?? obs.pressure };
  });
}
function normalizeWindy(payload){
  if (Array.isArray(payload?.rows)) return payload.rows;
  return WINDY_STATIONS.map(st => ({...st, error: payload?.message || payload?.error || 'Windy bíður'}));
}
function withCell(label, html){ return `<td data-label="${label}">${html}</td>`; }
function renderLive(rows){
  $('liveBody').innerHTML = rows.map(r => {
    const hasData = [r.temp,r.wind,r.gust,r.dir,r.precip,r.humidity,r.pressure].some(v => Number.isFinite(Number(v)));
    const cells = [
      `<span class="station-name"><b>${r.name}</b><span class="station-source">${r.source}${r.error ? ' · bíður' : ''}</span></span>`,
      fmtTime(r.time), fmt(r.temp,'°C'), fmt(r.wind,' m/s'), fmt(r.gust,' m/s'), windArrowToward(r.dir), fmt(r.precip,' mm'), fmt(r.humidity,' %'), fmt(r.pressure,' hPa')
    ];
    return `<tr class="${hasData ? '' : 'no-data'}">${cells.map((c,i)=>withCell(labels[i],c)).join('')}</tr>`;
  }).join('');
  renderSkiSummary(rows);
}
function renderSkiSummary(rows){
  const valid = rows.filter(r => [r.temp,r.wind,r.gust].some(v => Number.isFinite(Number(v))));
  const top = rows.find(r => r.id === '2636') || valid[0];
  const coldVals = valid.map(r => Number(r.temp)).filter(Number.isFinite);
  const gustVals = valid.map(r => Number(r.gust || r.wind)).filter(Number.isFinite);
  const maxGust = gustVals.length ? Math.max(...gustVals) : null;
  const cold = coldVals.length ? Math.min(...coldVals) : null;
  const status = maxGust == null ? 'Bíður gagna' : maxGust >= 18 ? 'Mjög hvasst' : maxGust >= 12 ? 'Vindasamt' : 'Rólegt / hóflegt';
  $('skiSummary').innerHTML = `
    <div class="summary-line"><span>Vindur efst</span><b>${top ? fmt(top.wind,' m/s') : '—'}</b></div>
    <div class="summary-line"><span>Kaldast</span><b>${cold == null ? '—' : fmt(cold,'°C')}</b></div>
    <div class="summary-line"><span>Staða</span><b>${status}</b></div>`;
}
function renderHourly(data){
  const hours = Array.isArray(data?.hours) ? data.hours : makeDemoHours();
  $('hourlyForecast').innerHTML = hours.slice(0,24).map(h => `<div class="hour"><div class="time">${fmtTime(h.time)}</div><strong>${fmt(h.temp,'°C')}</strong><div class="wind">${windArrowToward(h.dir)} ${fmt(h.wind,' m/s')}</div><div class="meta">${fmt(h.precip,' mm')} úrk.</div></div>`).join('');
}
function makeDemoHours(){return Array.from({length:24},(_,i)=>({time:Date.now()+i*3600000,temp:-2+Math.sin(i/3)*2,wind:4+Math.cos(i/4)*2,dir:220+i*5,precip:i%5===0?.4:0}));}
function drawTrend(data){
  const c = $('trendChart'), ctx=c.getContext('2d'), scale=window.devicePixelRatio||1, w=c.width=c.clientWidth*scale, h=c.height=180*scale; ctx.clearRect(0,0,w,h);
  const points = Array.isArray(data?.points) ? data.points : Array.from({length:24},(_,i)=>({t:i,v:-3+Math.sin(i/4)*3}));
  const vals = points.map(p=>Number(p.v)).filter(Number.isFinite); if(!vals.length){ $('trendNote').textContent='Engin þróunargögn fundust.'; return; }
  const min=Math.min(...vals)-1,max=Math.max(...vals)+1; ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1*scale; for(let i=0;i<4;i++){let y=h*(i+1)/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.strokeStyle='#7dd3fc';ctx.lineWidth=3*scale;ctx.beginPath(); points.forEach((p,i)=>{let x=i/(points.length-1)*w,y=h-((Number(p.v)-min)/(max-min))*h; i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  $('trendNote').textContent = `Hiti síðustu 24 klst. Lægst ${Math.min(...vals).toFixed(1)}°C, hæst ${Math.max(...vals).toFixed(1)}°C.`;
}
function renderWarnings(payload){
  const items = payload?.warnings || payload?.items || payload?.features || [];
  const active = items.filter(w => JSON.stringify(w).toLowerCase().includes('vest') || JSON.stringify(w).toLowerCase().includes('isaf'));
  if(!active.length){ $('warningsCard').classList.add('hidden'); $('warnings').innerHTML=''; return; }
  $('warningsCard').classList.remove('hidden');
  $('warnings').innerHTML = active.map(w=>{
    const p = w.properties || w;
    return `<div class="warning-item"><b>${p.title||p.event||p.headline||'Viðvörun'}</b><p class="muted small">${p.area||p.areaDesc||p.severity||''}</p><p>${p.description||p.summary||p.instruction||''}</p></div>`;
  }).join('');
}
function showWindyHelp(payload, windyRows){
  const ok = windyRows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  if(ok){ $('windyHelp').classList.add('hidden'); return; }
  $('windyHelp').classList.remove('hidden');
  $('windyHelp').textContent = payload?.message || payload?.error || 'Windy PWS mælingar skila ekki gögnum enn. Athugaðu hvort þú sért með Windy Stations API lykil, ekki bara Map Forecast lykil.';
}
async function loadAll(){
  $('systemStatus').textContent='Sæki gögn…';
  const [imo, windy, forecast, trend, warn] = await Promise.allSettled([
    getJSON('/.netlify/functions/weather?kind=latest'),
    getJSON('/.netlify/functions/windy-stations'),
    getJSON('/.netlify/functions/weather?kind=forecast24'),
    getJSON('/.netlify/functions/weather?kind=history24'),
    getJSON('/.netlify/functions/warnings')
  ]);
  const imoRows = imo.status==='fulfilled'?normalizeIMO(imo.value):IMO_STATIONS.map(s=>({...s, source:'Veðurstofan', error:'IMO kall mistókst'}));
  const windyPayload = windy.status==='fulfilled' ? windy.value : {ok:false,error:'Windy kall mistókst'};
  const windyRows = normalizeWindy(windyPayload);
  renderLive([...imoRows, ...windyRows]); showWindyHelp(windyPayload, windyRows);
  renderHourly(forecast.status==='fulfilled'?forecast.value:null); drawTrend(trend.status==='fulfilled'?trend.value:null); renderWarnings(warn.status==='fulfilled'?warn.value:null);
  const imoOk = imoRows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  const windyOk = windyRows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  $('latestBadge').textContent = `Uppfært ${fmtTime(Date.now())}`;
  $('systemStatus').textContent = `${imoOk ? 'Veðurstofan OK' : 'Veðurstofan bíður'} · ${windyOk ? 'Windy OK' : 'Windy bíður'}`;
}
window.addEventListener('error', e => { $('systemStatus').textContent = 'Villa: ' + e.message; });
$('refreshBtn').addEventListener('click', loadAll);
document.querySelectorAll('.windy-tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.windy-tabs button').forEach(b=>b.classList.remove('active'));btn.classList.add('active'); $('windyFrame').src = $('windyFrame').src.replace(/overlay=[^&]+/,`overlay=${btn.dataset.overlay}`)}));
loadAll(); setInterval(loadAll, 10*60*1000); window.addEventListener('resize',()=>drawTrend(null));
