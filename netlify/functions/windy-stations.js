const STATIONS = ['pws-f046eee0','pws-2f046eee0','pws-1f046eee0'];
exports.handler = async () => {
  const key = process.env.WINDY_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'WINDY_API_KEY vantar í Netlify Environment variables' }) };
  const headers = { 'content-type':'application/json' };
  const out = {};
  for (const id of STATIONS) {
    const candidates = [
      `https://stations.windy.com/pws/station/${encodeURIComponent(key)}/${encodeURIComponent(id)}`,
      `https://stations.windy.com/pws/station/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`,
      `https://stations.windy.com/api/v2/pws/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`
    ];
    let lastErr = null;
    for (const url of candidates) {
      try {
        const r = await fetch(url, { headers: { 'windy-api-key': key, 'x-windy-api-key': key }});
        const text = await r.text();
        if (!r.ok) { lastErr = `${r.status} ${text.slice(0,120)}`; continue; }
        try { out[id] = JSON.parse(text); } catch { out[id] = { raw: text }; }
        lastErr = null; break;
      } catch (e) { lastErr = e.message; }
    }
    if (lastErr) out[id] = { error: lastErr };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ stations: out, fetchedAt: new Date().toISOString() }) };
};
