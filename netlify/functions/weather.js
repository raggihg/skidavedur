const STATIONS = [
  { id: '2636', name: 'Þverfjall' },
  { id: '2641', name: 'Seljalandsdalur – skíðaskáli' },
  { id: '2644', name: 'Tungudalur' },
];

const stationParam = STATIONS.map(s => s.id).join(',');
const jsonHeaders = { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' };

async function fetchText(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }});
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url} :: ${text.slice(0,180)}`);
  return { url, text, json: safeJson(text) };
}
function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }
function getByPath(obj, path) { return path.split('.').reduce((o,k)=>o && o[k], obj); }
function arrify(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function firstDefined(...vals) { return vals.find(v => v !== undefined && v !== null && v !== ''); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function flattenCandidates(payload) {
  const roots = [payload, payload?.data, payload?.stations, payload?.results, payload?.items, payload?.observations];
  const out = [];
  function walk(x) {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x !== 'object') return;
    const sid = firstDefined(x.station_id, x.stationId, x.station, x.id, x.sid, x.wmo, x.name?.id);
    const hasObsFields = ['T','F','FX','D','RH','P','R','temperature','wind_speed','windSpeed','windDirection','time','date','timestamp'].some(k => x[k] !== undefined);
    if (sid || hasObsFields) out.push(x);
    ['observations','data','values','measurements','latest','obs'].forEach(k => { if (x[k]) walk(x[k]); });
  }
  roots.forEach(walk);
  return out;
}

function normalizeObservationPayload(payload, sourceUrl) {
  const candidates = flattenCandidates(payload);
  const rows = STATIONS.map(st => {
    const matches = candidates.filter(x => String(firstDefined(x.station_id, x.stationId, x.station, x.id, x.sid, x.wmo, x.station?.id)) === st.id);
    const raw = matches[0] || {};
    const obs = raw.observations?.[0] || raw.data?.[0] || raw.values?.[0] || raw.latest || raw.obs || raw;
    return {
      id: st.id,
      name: st.name,
      source: 'Veðurstofan',
      sourceUrl,
      time: firstDefined(obs.time, obs.date, obs.timestamp, obs.valid_time, obs.validTime, raw.time, raw.date, raw.timestamp),
      temp: num(firstDefined(obs.T, obs.t, obs.temp, obs.temperature, obs.air_temperature)),
      wind: num(firstDefined(obs.F, obs.f, obs.wind, obs.wind_speed, obs.windSpeed, obs.wind_speed_10m)),
      gust: num(firstDefined(obs.FX, obs.FG, obs.gust, obs.wind_gust, obs.windGust, obs.max_wind_speed)),
      dir: num(firstDefined(obs.D, obs.d, obs.dir, obs.wind_direction, obs.windDirection, obs.wind_dir)),
      precip: num(firstDefined(obs.R, obs.r, obs.precip, obs.precipitation, obs.rain, obs.accumulated_precipitation)),
      humidity: num(firstDefined(obs.RH, obs.rh, obs.humidity, obs.relative_humidity)),
      pressure: num(firstDefined(obs.P, obs.p, obs.pressure, obs.mslp, obs.air_pressure))
    };
  });
  return rows;
}

async function latest() {
  const urls = [
    `https://api.vedur.is/weather/observations/aws/hour/latest?stations=${stationParam}&parameters=basic`,
    `https://api.vedur.is/weather/observations/aws/raw/10min/latest?stations=${stationParam}&parameters=basic`,
    `https://api.vedur.is/weather/observations/aws/hour/latest?stations=${stationParam}`,
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetchText(url);
      const rows = normalizeObservationPayload(res.json, res.url);
      const hasAny = rows.some(r => r.temp !== null || r.wind !== null || r.gust !== null || r.dir !== null);
      if (hasAny) return { ok: true, rows, endpoint: res.url, fetchedAt: new Date().toISOString() };
      errors.push(`Engin þekkt mæligildi úr ${url}`);
    } catch (e) { errors.push(e.message); }
  }
  return { ok: false, rows: STATIONS.map(s => ({...s, source:'Veðurstofan'})), errors, fetchedAt: new Date().toISOString() };
}

async function passthrough(kind) {
  const urls = kind === 'history24'
    ? [`https://api.vedur.is/weather/observations/aws/hour?stations=2636&parameters=T&time=24h`]
    : [`https://api.vedur.is/weather/forecasts/point?lat=66.0&lon=-23.25`];
  try { const res = await fetchText(urls[0]); return res.json || {}; }
  catch (e) { return { ok:false, error:e.message }; }
}

exports.handler = async (event) => {
  const kind = event.queryStringParameters?.kind || 'latest';
  try {
    let body;
    if (kind === 'latest') body = await latest();
    else if (kind === 'history24' || kind === 'forecast24') body = await passthrough(kind);
    else body = { ok:false, error:'unknown kind' };
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(body) };
  } catch (e) {
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};
