const STATIONS = [
  { id: 'pws-f046eee0', shortId: 'f046eee0', name: 'Nónvatn' },
  { id: 'pws-2f046eee0', shortId: '2f046eee0', name: 'Heiðin' },
  { id: 'pws-1f046eee0', shortId: '1f046eee0', name: 'Miðfellsháls' },
];
const headers = { 'content-type':'application/json', 'cache-control':'public, max-age=60' };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const first = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

function normalizeOne(st, raw){
  const obs = raw?.observation || raw?.observations?.[0] || raw?.data?.[0] || raw?.latest || raw?.current || raw || {};
  return {
    id: st.id, name: st.name, source: 'Windy PWS',
    time: first(obs.ts, obs.time, obs.date, obs.timestamp, obs.updated, raw?.updated),
    temp: num(first(obs.temp, obs.temperature, obs.tempf != null ? (obs.tempf-32)*5/9 : null)),
    wind: num(first(obs.wind, obs.windSpeed, obs.wind_speed, obs.wind_avg, obs.windspeed)),
    gust: num(first(obs.gust, obs.windGust, obs.wind_gust, obs.wind_max, obs.windgust)),
    dir: num(first(obs.windDir, obs.windDirection, obs.wind_direction, obs.wind_dir, obs.dir)),
    precip: num(first(obs.precip, obs.precipitation, obs.rain, obs.rain_mm)),
    humidity: num(first(obs.humidity, obs.rh, obs.relative_humidity)),
    pressure: num(first(obs.pressure, obs.mbar, obs.barometer))
  };
}
async function fetchJson(url, opts={}){
  const r = await fetch(url, opts); const text = await r.text();
  if(!r.ok) throw new Error(`${r.status} ${url} :: ${text.slice(0,160)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Ekki JSON frá ${url}`); }
}
function findStationPayload(listPayload, st){
  const arr = Array.isArray(listPayload) ? listPayload : Array.isArray(listPayload?.data) ? listPayload.data : Array.isArray(listPayload?.stations) ? listPayload.stations : Array.isArray(listPayload?.items) ? listPayload.items : [];
  return arr.find(x => String(first(x.id, x.stationId, x.station_id, x.pwsId, x.name)).includes(st.shortId));
}
exports.handler = async () => {
  const key = process.env.vedur_api || process.env.VEDUR_API || process.env.WINDY_STATIONS_API_KEY || process.env.WINDY_API_KEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ ok:false, error:'vedur_api vantar í Netlify Environment variables', rows: STATIONS.map(s=>({...s, source:'Windy PWS'})) }) };
  const attempts = [];
  try {
    const list = await fetchJson(`https://stations.windy.com/api/v2/pws?key=${encodeURIComponent(key)}`);
    const rows = STATIONS.map(st => {
      const raw = findStationPayload(list, st);
      return raw ? normalizeOne(st, raw) : { id: st.id, name: st.name, source:'Windy PWS', error:'Fannst ekki í Stations API lista' };
    });
    if(rows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))))) return { statusCode:200, headers, body: JSON.stringify({ ok:true, rows, endpoint:'api/v2/pws' }) };
    attempts.push('api/v2/pws skilaði engum þekktum mæligildum');
  } catch(e){ attempts.push(e.message); }

  const rows = [];
  for (const st of STATIONS) {
    let row = null;
    for (const sid of [st.id, st.shortId]) {
      const urls = [
        `https://stations.windy.com/api/v2/pws/${encodeURIComponent(sid)}?key=${encodeURIComponent(key)}`,
        `https://stations.windy.com/pws/station/open/${encodeURIComponent(key)}/${encodeURIComponent(sid)}`
      ];
      for (const url of urls) {
        try {
          const raw = await fetchJson(url);
          row = normalizeOne(st, raw);
          if ([row.temp,row.wind,row.gust,row.dir].some(v => Number.isFinite(Number(v)))) break;
        } catch(e){ attempts.push(e.message); }
      }
      if(row && [row.temp,row.wind,row.gust,row.dir].some(v => Number.isFinite(Number(v)))) break;
    }
    rows.push(row || { id: st.id, name: st.name, source:'Windy PWS', error:'Engin mæligögn fundust' });
  }
  const ok = rows.some(r => [r.temp,r.wind,r.gust,r.dir].some(v => Number.isFinite(Number(v))));
  return { statusCode: 200, headers, body: JSON.stringify({ ok, rows, message: ok ? 'Windy PWS tenging virk.' : 'Windy PWS skilar ekki gögnum. Líklegast þarf sérstakan Windy Stations API lykil; Map Forecast lykillinn dugar oft aðeins fyrir kortið.', attempts: attempts.slice(0,8) }) };
};
