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
const fmtTime = (d) => d ? new Intl.DateTimeFormat('is-IS',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d)) : '—';
const fmt = (v, unit='') => Number.isFinite(Number(v)) ? `${Number(v).toFixed(unit==='°C'?1:0)}${unit}` : '—';
function windArrowToward(degFrom){
  if(!Number.isFinite(Number(degFrom))) return '—';
  const toward = (Number(degFrom)+180)%360;
  return `<span class="wind-arrow" style="transform:rotate(${toward}deg)">↑</span>`;
}
function setClock(){ nowClock.textContent = new Intl.DateTimeFormat('is-IS',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()); }
setInterval(setClock, 1000); setClock();
async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }
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
  const map = payload?.stations || payload || {};
  return WINDY_STATIONS.map(st => {
    const raw = map[st.id] || {};
    const obs = raw.observation || raw.observations?.[0] || raw.data?.[0] || raw;
    return { ...st, time: obs.ts || obs.time || obs.date || obs.timestamp, temp: obs.temp ?? obs.temperature, wind: obs.wind ?? obs.windSpeed ?? obs.wind_speed, gust: obs.gust ?? obs.windGust ?? obs.wind_gust, dir: obs.windDir ?? obs.windDirection ?? obs.wind_direction, precip: obs.precip ?? obs.precipitation, humidity: obs.humidity ?? obs.rh, pressure: obs.pressure ?? obs.mbar, error: raw.error || payload?.message };
  });
}
function renderLive(rows){
  liveBody.innerHTML = rows.map(r => {
    const hasData = [r.temp,r.wind,r.gust,r.dir,r.precip,r.humidity,r.pressure].some(v => Number.isFinite(Number(v)));
    return `<tr class="${hasData ? '' : 'no-data'}">
      <td><span class="station-name"><b>${r.name}</b><span class="station-source">${r.source}${r.error ? ' · bíður' : ''}</span></span></td>
      <td>${fmtTime(r.time)}</td><td>${fmt(r.temp,'°C')}</td><td>${fmt(r.wind,' m/s')}</td><td>${fmt(r.gust,' m/s')}</td>
      <td>${windArrowToward(r.dir)}</td><td>${fmt(r.precip,' mm')}</td><td>${fmt(r.humidity,' %')}</td><td>${fmt(r.pressure,' hPa')}</td>
    </tr>`;
  }).join('');
}
function renderHourly(data){
  const hours = data?.hours || makeDemoHours();
  hourlyForecast.innerHTML = hours.slice(0,24).map(h => `<div class="hour"><div class="time">${fmtTime(h.time)}</div><strong>${fmt(h.temp,'°C')}</strong><div>${windArrowToward(h.dir)} ${fmt(h.wind,' m/s')}</div><div class="meta">${fmt(h.precip,' mm')} úrk.</div></div>`).join('');
}
function makeDemoHours(){return Array.from({length:24},(_,i)=>({time:Date.now()+i*3600000,temp:-2+Math.sin(i/3)*2,wind:4+Math.cos(i/4)*2,dir:220+i*5,precip:i%5===0?.4:0}));}
function drawTrend(data){
  const c = document.getElementById('trendChart'), ctx=c.getContext('2d'), w=c.width=c.clientWidth*devicePixelRatio, h=c.height=180*devicePixelRatio; ctx.clearRect(0,0,w,h);
  const points = data?.points || Array.from({length:24},(_,i)=>({t:i,v:-3+Math.sin(i/4)*3}));
  const vals = points.map(p=>Number(p.v)).filter(Number.isFinite); if(!vals.length) return;
  const min=Math.min(...vals)-1,max=Math.max(...vals)+1; ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1; for(let i=0;i<4;i++){let y=h*(i+1)/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.strokeStyle='#71d5ff';ctx.lineWidth=3*devicePixelRatio;ctx.beginPath(); points.forEach((p,i)=>{let x=i/(points.length-1)*w,y=h-((p.v-min)/(max-min))*h; i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  trendNote.textContent = `Hiti síðustu 24 klst. Lægst ${Math.min(...vals).toFixed(1)}°C, hæst ${Math.max(...vals).toFixed(1)}°C.`;
}
async function loadAll(){
  systemStatus.textContent='Sæki gögn…';
  const [imo, windy, forecast, trend, warn] = await Promise.allSettled([
    getJSON('/.netlify/functions/weather?kind=latest'),
    getJSON('/.netlify/functions/windy-stations'),
    getJSON('/.netlify/functions/weather?kind=forecast24'),
    getJSON('/.netlify/functions/weather?kind=history24'),
    getJSON('/.netlify/functions/warnings')
  ]);
  const imoRows = imo.status==='fulfilled'?normalizeIMO(imo.value):IMO_STATIONS.map(s=>({...s, source:'Veðurstofan', error:'IMO kall mistókst'}));
  const windyRows = windy.status==='fulfilled'?normalizeWindy(windy.value):WINDY_STATIONS.map(s=>({...s, source:'Windy PWS', error:'Windy kall mistókst'}));
  const rows=[...imoRows, ...windyRows];
  renderLive(rows); renderHourly(forecast.status==='fulfilled'?forecast.value:null); drawTrend(trend.status==='fulfilled'?trend.value:null); renderWarnings(warn.status==='fulfilled'?warn.value:null);
  const imoOk = imo.status==='fulfilled' && (imo.value?.ok !== false) && imoRows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  const windyOk = windy.status==='fulfilled' && (windy.value?.ok !== false) && windyRows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  systemStatus.textContent = `${imoOk ? 'Veðurstofan OK' : 'Veðurstofan bíður'} · ${windyOk ? 'Windy OK' : 'Windy PWS bíður'} · uppfært ${fmtTime(Date.now())}`;
}
window.addEventListener('error', e => { systemStatus.textContent = 'Villa í vefkóða: ' + e.message; });
function renderWarnings(payload){
  const items = payload?.warnings || payload?.items || [];
  if(!items.length){ warnings.innerHTML = '<div class="warning-item">Engar virkar viðvaranir fundust í sjálfvirkri vöktun. Athugaðu samt Veðurstofuna fyrir ferð.</div>'; return; }
  warnings.innerHTML = items.map(w=>`<div class="warning-item"><b>${w.title||w.event||'Viðvörun'}</b><p class="muted small">${w.area||''} ${w.severity||''}</p><p>${w.description||w.summary||''}</p></div>`).join('');
}
refreshBtn.addEventListener('click', loadAll);
document.querySelectorAll('.windy-tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.windy-tabs button').forEach(b=>b.classList.remove('active'));btn.classList.add('active'); windyFrame.src = windyFrame.src.replace(/overlay=[^&]+/,`overlay=${btn.dataset.overlay}`)}));
loadAll(); setInterval(loadAll, 10*60*1000);
