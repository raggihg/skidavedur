const STATIONS = [
  { id: 'pws-f046eee0', rawId: 'f046eee0', name: 'Nónvatn' },
  { id: 'pws-2f046eee0', rawId: '2f046eee0', name: 'Heiðin' },
  { id: 'pws-1f046eee0', rawId: '1f046eee0', name: 'Miðfellsháls' },
];

const headers = { 'content-type':'application/json', 'cache-control':'public, max-age=60' };
const num = v => {
  if (v === undefined || v === null || v === '' || v === '--') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const first = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '' && v !== '--');

function maybeMsOrSec(v){
  const n = num(v);
  if (n === null) return null;
  if (n > 100000000000) return new Date(n).toISOString();
  if (n > 1000000000) return new Date(n * 1000).toISOString();
  return v;
}
function kpaPaToHpa(v){
  const n = num(v);
  if (n === null) return null;
  if (n > 20000) return n / 100; // Pa -> hPa
  return n;
}
function extractWindDir(obs){ return num(first(obs.winddir, obs.windDir, obs.windDirection, obs.wind_direction, obs.dir, obs.wd, obs.D)); }
function extractObservationObjects(raw){
  const out = [];
  const seen = new Set();
  function score(o){
    if (!o || typeof o !== 'object') return 0;
    let s = 0;
    ['temp','temperature','T','wind','windSpeed','wind_speed','gust','windGust','winddir','windDir','humidity','pressure','precip','ts','time','timestamp'].forEach(k=>{ if(o[k] !== undefined) s++; });
    return s;
  }
  function walk(x, depth=0){
    if (!x || depth > 7) return;
    if (Array.isArray(x)) { x.forEach(v=>walk(v, depth+1)); return; }
    if (typeof x !== 'object') return;
    if (!seen.has(x) && score(x) >= 2) { seen.add(x); out.push(x); }
    for (const key of ['observation','observations','latest','current','data','items','values','measurements','lastObservation','last','history','records']) {
      if (x[key]) walk(x[key], depth+1);
    }
  }
  walk(raw);
  return out.sort((a,b)=>score(b)-score(a));
}
function normalizeOne(st, raw, endpoint){
  const candidates = extractObservationObjects(raw);
  const obs = candidates[0] || raw?.observation || raw?.observations?.[0] || raw?.data?.[0] || raw?.latest || raw?.current || raw || {};
  const temp = num(first(obs.temp, obs.temperature, obs.temp_c, obs.airtemp, obs.T, obs.t, obs.tempf != null ? (Number(obs.tempf)-32)*5/9 : null));
  const wind = num(first(obs.wind, obs.windSpeed, obs.wind_speed, obs.wind_avg, obs.windspeed, obs.ws, obs.F, obs.f));
  const gust = num(first(obs.gust, obs.windGust, obs.wind_gust, obs.wind_max, obs.windgust, obs.maxwind, obs.FX, obs.FG));
  const dir = extractWindDir(obs);
  const precip = num(first(obs.precip, obs.precipitation, obs.rain, obs.rain_mm, obs.rainfall, obs.R, obs.r));
  const humidity = num(first(obs.humidity, obs.rh, obs.relative_humidity, obs.RH));
  const pressure = kpaPaToHpa(first(obs.pressure, obs.mbar, obs.barometer, obs.p, obs.P));
  const time = maybeMsOrSec(first(obs.ts, obs.time, obs.date, obs.timestamp, obs.updated, obs.updatedAt, raw?.updated, raw?.updatedAt));
  const hasData = [temp, wind, gust, dir, precip, humidity, pressure].some(v => Number.isFinite(Number(v)) && Number(v) !== 0) || [temp, wind, gust, dir, precip, humidity, pressure].some(v => Number.isFinite(Number(v))) && time;
  return { id: st.id, name: st.name, source: 'Windy PWS', time, temp, wind, gust, dir, precip, humidity, pressure, endpoint, hasData };
}
async function fetchJson(url, key, method='GET'){
  const r = await fetch(url, { method, headers: { accept:'application/json', 'windy-api-key': key }});
  const text = await r.text();
  if(!r.ok) throw new Error(`${r.status} ${url.replace(key,'***')} :: ${text.slice(0,120)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Ekki JSON frá ${url.replace(key,'***')}: ${text.slice(0,80)}`); }
}
function findStationPayload(listPayload, st){
  const arr = Array.isArray(listPayload) ? listPayload : Array.isArray(listPayload?.data) ? listPayload.data : Array.isArray(listPayload?.stations) ? listPayload.stations : Array.isArray(listPayload?.items) ? listPayload.items : [];
  return arr.find(x => JSON.stringify(x).includes(st.rawId));
}
function stationUrls(st, key){
  const ids = [st.id, st.rawId];
  const urls = [];
  for (const sid of ids) {
    const enc = encodeURIComponent(sid);
    urls.push(`https://stations.windy.com/api/v2/pws/${enc}?key=${encodeURIComponent(key)}`);
    urls.push(`https://stations.windy.com/api/v2/pws/${enc}/observations/latest?key=${encodeURIComponent(key)}`);
    urls.push(`https://stations.windy.com/api/v2/stations/${enc}/observations/latest?key=${encodeURIComponent(key)}`);
    urls.push(`https://stations.windy.com/api/v2/observation/latest?id=${enc}&key=${encodeURIComponent(key)}`);
    urls.push(`https://stations.windy.com/api/v2/observations/latest?id=${enc}&key=${encodeURIComponent(key)}`);
    urls.push(`https://stations.windy.com/api/v2/observation?stationId=${enc}&limit=1&key=${encodeURIComponent(key)}`);
  }
  return urls;
}
function hasRealMeasurements(row){
  return [row.temp,row.wind,row.gust,row.dir,row.precip,row.humidity,row.pressure].some(v => Number.isFinite(Number(v)) && Number(v) !== 0) || (row.time && [row.temp,row.wind,row.gust,row.dir].some(v => Number.isFinite(Number(v))));
}
exports.handler = async (event) => {
  const key = process.env.vedur_api || process.env.VEDUR_API || process.env.WINDY_STATIONS_API_KEY || process.env.WINDY_API_KEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ ok:false, error:'vedur_api vantar í Netlify Environment variables', rows: STATIONS.map(s=>({...s, source:'Windy PWS'})) }) };
  const debug = event.queryStringParameters?.debug === '1';
  const attempts = [];
  const debugInfo = [];

  // 1) Public/open station list. Often returns station metadata + last observation.
  try {
    const endpoint = 'https://stations.windy.com/api/v2/pws';
    const list = await fetchJson(`${endpoint}?key=${encodeURIComponent(key)}`, key);
    const rows = STATIONS.map(st => {
      const raw = findStationPayload(list, st);
      const row = raw ? normalizeOne(st, raw, endpoint) : { id: st.id, name: st.name, source:'Windy PWS', error:'Fannst ekki í Stations API lista' };
      if (debug && raw) debugInfo.push({ station: st.name, endpoint, keys: Object.keys(raw).slice(0,30), sample: JSON.stringify(raw).slice(0,800) });
      return row;
    });
    if(rows.some(hasRealMeasurements)) return { statusCode:200, headers, body: JSON.stringify({ ok:true, rows, endpoint, debug: debug ? debugInfo : undefined }) };
    attempts.push('api/v2/pws fann stöðvar en engin raunmæligildi voru lesin úr svarinu');
  } catch(e){ attempts.push(e.message); }

  // 2) Try station-specific latest-observation shapes. Windy Stations API v2 is new and endpoint naming has changed.
  const rows = [];
  for (const st of STATIONS) {
    let best = null;
    for (const url of stationUrls(st, key)) {
      try {
        const raw = await fetchJson(url, key);
        const row = normalizeOne(st, raw, url.replace(key,'***'));
        if (debug) debugInfo.push({ station: st.name, endpoint: url.replace(key,'***'), keys: raw && typeof raw === 'object' ? Object.keys(raw).slice(0,30) : [], sample: JSON.stringify(raw).slice(0,800), parsed: row });
        if (!best || hasRealMeasurements(row)) best = row;
        if (hasRealMeasurements(row)) break;
      } catch(e){ attempts.push(e.message); }
    }
    rows.push(best || { id: st.id, name: st.name, source:'Windy PWS', error:'Engin mæligögn fundust' });
  }
  const ok = rows.some(hasRealMeasurements);
  return { statusCode: 200, headers, body: JSON.stringify({ ok, rows, message: ok ? 'Windy PWS tenging virk.' : 'Windy PWS fann stöðvar en las ekki mæligildi. Opnaðu /.netlify/functions/windy-stations?debug=1 til að sjá hvaða field nöfn Windy skilar.', attempts: attempts.slice(0,10), debug: debug ? debugInfo : undefined }) };
};
