const STATIONS = [
  { id: '2641', name: 'Seljalandsdalur · skíðaskáli', short: 'Skíðaskáli' },
  { id: '2644', name: 'Ísafjörður · Tungudalur', short: 'Tungudalur' },
  { id: '2636', name: 'Þverfjall', short: 'Þverfjall' }
];
const PLACE = { lat: 66.074, lon: -23.126, name: 'Skíðasvæði Ísafjarðarbæjar' };
const API = '/.netlify/functions/weather';
const fmtTime = d => new Intl.DateTimeFormat('is-IS',{hour:'2-digit',minute:'2-digit',weekday:'short'}).format(new Date(d));
const fmtShort = d => new Intl.DateTimeFormat('is-IS',{hour:'2-digit',minute:'2-digit'}).format(new Date(d));

function degToCompass(deg){ if(deg==null||Number.isNaN(+deg)) return '—'; const dirs=['N','NNA','NA','ANA','A','ASA','SA','SSA','S','SSV','SV','VSV','V','VNV','NV','NNV']; return dirs[Math.round((+deg%360)/22.5)%16]; }
function windArrow(deg){ if(deg==null||Number.isNaN(+deg)) return '↗'; return '↑'; }
function valueOf(row, keys){ for(const k of keys){ if(row && row[k] != null) return row[k]; if(row?.parameters?.[k]?.value != null) return row.parameters[k].value; if(row?.measurements?.[k] != null) return row.measurements[k]; } return null; }
async function fetchJson(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+url); return r.json(); }

function unwrap(payload){ return payload && payload.data !== undefined ? payload.data : payload; }
async function getLatestObs(){
  const payload = await fetchJson(`${API}?kind=latest`);
  if(!payload?.ok) throw new Error(payload?.error || 'Náði ekki nýjustu mælingum');
  return unwrap(payload);
}
async function getHistory(){
  const payload = await fetchJson(`${API}?kind=history`);
  if(!payload?.ok) return null;
  return unwrap(payload);
}
async function getForecast(){
  const payload = await fetchJson(`${API}?kind=forecast`);
  if(!payload?.ok) throw new Error(payload?.error || 'Náði ekki klukkustundaspá');
  return unwrap(payload);
}
async function getWarnings(){
  const payload = await fetchJson(`${API}?kind=warnings`);
  if(!payload?.ok) return null;
  return unwrap(payload);
}
function flattenObs(data){
  const arr = Array.isArray(data) ? data : data?.results || data?.data || data?.observations || data?.items || data?.features || [];
  return arr.flatMap(x => {
    if(Array.isArray(x.observations)) return x.observations.map(o=>({...o, station_id:x.station_id||x.id||x.station||x.stationId}));
    if(Array.isArray(x.data)) return x.data.map(o=>({...o, station_id:x.station_id||x.id||x.station||x.stationId}));
    return [x];
  });
}
function stationKey(row){
  return String(row?.station_id || row?.station || row?.stationId || row?.id || row?.properties?.station_id || row?.station?.id || '');
}
function findStationRow(arr, id){
  return arr.find(x => stationKey(x) === id) || arr.find(x => JSON.stringify(x).includes(id)) || {};
}

function renderStations(data){
  const arr = flattenObs(data);
  document.getElementById('stationCards').innerHTML = STATIONS.map(st=>{
    const row = findStationRow(arr, st.id);
    const t = valueOf(row,['T','t','temp','temperature','air_temperature']);
    const f = valueOf(row,['F','f','wind_speed','windSpeed','ff','wind']);
    const fx = valueOf(row,['FX','fx','FG','gust','wind_gust','max_wind_speed']);
    const d = valueOf(row,['D','d','wind_direction','windDirection','dd']);
    return `<article class="card"><h3>${st.name}</h3><span class="muted">Stöð ${st.id}</span><div class="metric-row"><div class="metric"><span>Hiti</span><strong>${t??'—'}°</strong></div><div class="metric"><span>Vindur</span><strong>${f??'—'} m/s</strong></div></div><div class="metric-row"><div><span class="wind-arrow" style="transform:rotate(${d||0}deg)">${windArrow(d)}</span><b>${degToCompass(d)}</b> <span class="muted">${d??'—'}°</span></div><div><span class="muted">Hviða</span> <b>${fx??'—'} m/s</b></div></div></article>`;
  }).join('');
  const winds = arr.map(r=>+valueOf(r,['F','wind_speed','windSpeed','ff'])).filter(Number.isFinite);
  const temps = arr.map(r=>+valueOf(r,['T','temp','temperature','air_temperature'])).filter(Number.isFinite);
  let score = 72; if(Math.max(...winds,0)>15) score-=35; else if(Math.max(...winds,0)>10) score-=18; if(Math.max(...temps,0)>3) score-=12; if(Math.min(...temps,99)<-10) score-=8;
  document.querySelector('#skiScore strong').textContent = Math.max(0,Math.min(100,Math.round(score))) + '/100';
}
function parseForecast(data){
  const series = data?.properties?.timeseries || data?.timeseries || data?.forecast || data?.data || [];
  return series.slice(0,24).map(x=>{
    const inst = x.data?.instant?.details || x.instant || x.details || x;
    const next1 = x.data?.next_1_hours?.details || x.next_1_hours || {};
    const summary = x.data?.next_1_hours?.summary?.symbol_code || x.symbol_code || x.summary || '';
    return {time:x.time||x.valid_time||x.date, temp:inst.air_temperature??inst.temperature??inst.T, wind:inst.wind_speed??inst.F, gust:inst.wind_speed_of_gust??inst.gust??inst.FX, dir:inst.wind_from_direction??inst.wind_direction??inst.D, precip:next1.precipitation_amount??x.precipitation_amount??0, summary};
  }).filter(x=>x.time);
}
let forecastMode='table', lastForecast=[];
function renderForecast(rows){
  lastForecast=rows;
  const el=document.getElementById('hourlyForecast');
  if(!rows.length){ el.innerHTML='<div class="warning warn">Náði ekki að birta klukkustundaspá. Prófaðu aftur síðar.</div>'; return; }
  if(forecastMode==='cards'){
    el.innerHTML=`<div class="hour-cards">${rows.map(r=>`<div class="hour-card"><span class="muted">${fmtShort(r.time)}</span><strong>${Math.round(r.temp??0)}°</strong><div><span class="wind-arrow" style="transform:rotate(${r.dir||0}deg)">↑</span>${Math.round(r.wind??0)} m/s</div><small>${r.precip??0} mm</small></div>`).join('')}</div>`;
  } else {
    el.innerHTML=`<table class="hourly-table"><thead><tr><th>Tími</th><th>Hiti</th><th>Vindur</th><th>Hviða</th><th>Átt</th><th>Úrkoma</th><th>Lýsing</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${fmtTime(r.time)}</b></td><td>${r.temp??'—'}°C</td><td>${r.wind??'—'} m/s</td><td>${r.gust??'—'} m/s</td><td><span class="wind-arrow" style="transform:rotate(${r.dir||0}deg)">↑</span>${degToCompass(r.dir)} ${r.dir?Math.round(r.dir)+'°':''}</td><td>${r.precip??0} mm</td><td>${String(r.summary||'').replaceAll('_',' ')}</td></tr>`).join('')}</tbody></table>`;
  }
}
function flattenHistory(data){ return flattenObs(data).map(r=>({station:stationKey(r), time:r.time||r.date||r.valid_time||r.observation_time||r.timestamp, temp:+valueOf(r,['T','t','temp','temperature','air_temperature']), wind:+valueOf(r,['F','f','wind_speed','windSpeed','ff','wind']), gust:+valueOf(r,['FX','fx','FG','gust','wind_gust','max_wind_speed'])})).filter(r=>r.time); }
function renderTrend(data){
  const rows = flattenHistory(data);
  const el = document.getElementById('trendSummary');
  if(!rows.length){ el.innerHTML='<div class="warning warn">Síðustu 24 klst. birtast þegar sögulegar mælingar svara frá API.</div>'; return; }
  const temps=rows.map(r=>r.temp).filter(Number.isFinite), winds=rows.map(r=>r.wind).filter(Number.isFinite), gusts=rows.map(r=>r.gust).filter(Number.isFinite);
  el.innerHTML=`<div class="pill"><span class="muted">Hæsti hiti</span><strong>${Math.max(...temps).toFixed(1)}°</strong></div><div class="pill"><span class="muted">Lægsti hiti</span><strong>${Math.min(...temps).toFixed(1)}°</strong></div><div class="pill"><span class="muted">Mesti vindur</span><strong>${Math.max(...winds).toFixed(1)} m/s</strong></div><div class="pill"><span class="muted">Mesta hviða</span><strong>${Math.max(...gusts).toFixed(1)} m/s</strong></div>`;
  drawChart(rows);
}
function drawChart(rows){
  const c=document.getElementById('trendChart'), ctx=c.getContext('2d'), W=c.width,H=c.height,p=48; ctx.clearRect(0,0,W,H); ctx.strokeStyle='#ffffff22'; ctx.lineWidth=1; for(let i=0;i<5;i++){let y=p+i*(H-2*p)/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(W-p,y);ctx.stroke();}
  const vals=rows.flatMap(r=>[r.temp,r.wind,r.gust]).filter(Number.isFinite); const min=Math.min(...vals)-2,max=Math.max(...vals)+2; const times=[...new Set(rows.map(r=>r.time))].sort(); const x=t=>p+times.indexOf(t)*(W-2*p)/Math.max(1,times.length-1); const y=v=>H-p-(v-min)*(H-2*p)/(max-min||1);
  [['temp','#7dd3fc'],['wind','#8ef0b0'],['gust','#ffd166']].forEach(([key,col])=>{ ctx.strokeStyle=col; ctx.lineWidth=3; ctx.beginPath(); let started=false; rows.filter(r=>Number.isFinite(r[key])).sort((a,b)=>new Date(a.time)-new Date(b.time)).forEach(r=>{ if(!started){ctx.moveTo(x(r.time),y(r[key]));started=true}else ctx.lineTo(x(r.time),y(r[key])); }); ctx.stroke(); });
  ctx.fillStyle='#d7e5f7'; ctx.font='22px system-ui'; ctx.fillText('Hiti',70,30); ctx.fillStyle='#8ef0b0'; ctx.fillText('Vindur',145,30); ctx.fillStyle='#ffd166'; ctx.fillText('Hviður',245,30);
}
function renderWarnings(data){
  const el=document.getElementById('warningsBox'); const arr=Array.isArray(data)?data:data?.features||data?.alerts||data?.items||[];
  const hits=arr.filter(a=>{const s=JSON.stringify(a).toLowerCase();return s.includes('vestfir')||s.includes('isaf')||s.includes('djúp')||s.includes('northwest');});
  if(!data){ el.innerHTML='<div class="warning warn"><b>Náði ekki að sækja viðvaranir.</b><br><span class="muted">Notaðu hnappinn til að opna Veðurstofu.</span></div>'; return; }
  if(!hits.length){ el.innerHTML='<div class="warning good"><b>Engin sértæk viðvörun fannst fyrir Vestfirði í virkum gögnum.</b><br><span class="muted">Athugaðu alltaf Veðurstofu áður en farið er á fjall.</span></div>'; return; }
  el.innerHTML=hits.slice(0,5).map(a=>`<div class="warning bad"><b>${a.title||a.properties?.headline||a.info?.headline||'Viðvörun'}</b><p>${a.description||a.properties?.description||a.info?.description||''}</p></div>`).join('');
}
document.querySelectorAll('[data-forecast]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-forecast]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); forecastMode=b.dataset.forecast; renderForecast(lastForecast);});
(async function init(){
  document.getElementById('updated').textContent='Uppfært: '+new Intl.DateTimeFormat('is-IS',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
  try{ renderStations(await getLatestObs()); }catch(e){ console.error(e); document.getElementById('stationCards').innerHTML='<div class="card warning warn"><b>Náði ekki live mælingum frá Veðurstofu núna.</b><br><span class="muted">Netlify Function/proxy sér um að sækja gögnin. Prófaðu að endurhlaða síðuna eða skoða Function log á Netlify.</span></div>'; }
  try{ renderForecast(parseForecast(await getForecast())); }catch(e){ renderForecast([]); }
  try{ renderTrend(await getHistory()); }catch(e){ renderTrend(null); }
  try{ renderWarnings(await getWarnings()); }catch(e){ renderWarnings(null); }
})();
