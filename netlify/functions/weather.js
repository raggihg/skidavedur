const STATIONS = ['2641','2644','2636'];
const VEDUR = 'https://api.vedur.is/weather';
const METNO = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=66.074&lon=-23.126';

async function getJson(url) {
  const r = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'user-agent': 'skidavedur-isafjordur/1.0 raggihg@gmail.com'
    }
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return await r.json();
}

function stationId(x) {
  return String(
    x?.station_id ?? x?.stationId ?? x?.station ?? x?.id ?? x?.station?.id ?? x?.properties?.station_id ?? ''
  );
}

function deepStationFilter(data) {
  if (Array.isArray(data)) return data.filter(x => STATIONS.includes(stationId(x)) || JSON.stringify(x).match(/\b(2641|2644|2636)\b/));
  if (Array.isArray(data?.results)) return { ...data, results: deepStationFilter(data.results) };
  if (Array.isArray(data?.data)) return { ...data, data: deepStationFilter(data.data) };
  if (Array.isArray(data?.items)) return { ...data, items: deepStationFilter(data.items) };
  if (Array.isArray(data?.observations)) return { ...data, observations: deepStationFilter(data.observations) };
  return data;
}

exports.handler = async (event) => {
  const kind = event.queryStringParameters?.kind || 'latest';
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': kind === 'latest' ? 'public, max-age=120' : 'public, max-age=600',
    'access-control-allow-origin': '*'
  };

  try {
    if (kind === 'latest') {
      // Fetch all latest basic AWS observations and filter locally. This avoids fragile station query names.
      const data = await getJson(`${VEDUR}/observations/aws/hour/latest?parameters=basic`);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: 'vedur-api-latest-all-filtered', data: deepStationFilter(data) }) };
    }

    if (kind === 'history') {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 3600 * 1000);
      const start = encodeURIComponent(from.toISOString());
      const end = encodeURIComponent(now.toISOString());
      const ids = STATIONS.join(',');
      const tries = [
        `${VEDUR}/observations/aws/hour?stations=${ids}&start_time=${start}&end_time=${end}&parameters=basic`,
        `${VEDUR}/observations/aws/hour?station_ids=${ids}&start_time=${start}&end_time=${end}&parameters=basic`,
        `${VEDUR}/observations/aws/hour?stations=${ids}&from=${start}&to=${end}&parameters=basic`,
        `${VEDUR}/observations/aws/hour?station_ids=${ids}&from=${start}&to=${end}&parameters=basic`,
        `${VEDUR}/observations/aws/hour?stations=${ids}&time_from=${start}&time_to=${end}&parameters=basic`
      ];
      const errors = [];
      for (const url of tries) {
        try {
          const data = await getJson(url);
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: url, data }) };
        } catch (e) { errors.push(String(e.message || e)); }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, data: [], errors }) };
    }

    if (kind === 'forecast') {
      const data = await getJson(METNO);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: 'met.no-locationforecast', data }) };
    }

    if (kind === 'warnings') {
      const urls = [
        'https://api.vedur.is/cap/1.0/alerts/active?lang=is',
        'https://api.vedur.is/cap/1.0/alerts/active',
        'https://api.vedur.is/cap/v1/alerts/active?lang=is'
      ];
      for (const url of urls) {
        try {
          const data = await getJson(url);
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: url, data }) };
        } catch (_) {}
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, data: [] }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Unknown kind' }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: String(e.message || e), data: [] }) };
  }
};
