const STATIONS = [
  { id: 'pws-f046eee0', name: 'Nónvatn' },
  { id: 'pws-2f046eee0', name: 'Heiðin' },
  { id: 'pws-1f046eee0', name: 'Miðfellsháls' },
];
const headers = { 'content-type':'application/json', 'cache-control':'public, max-age=60' };

exports.handler = async () => {
  const key = process.env.WINDY_API_KEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ ok:false, error:'WINDY_API_KEY vantar í Netlify Environment variables', rows: STATIONS.map(s=>({...s, source:'Windy PWS'})) }) };

  // Ath: Map Forecast API lykill virkar fyrir Windy kort, en ekki endilega fyrir PWS/station gögn.
  // Þessi function má bila mjúklega svo Veðurstofu-mælingar haldi áfram að birtast.
  const rows = STATIONS.map(s => ({ ...s, source: 'Windy PWS', error: 'Windy PWS gögn ekki tengd enn' }));
  return { statusCode: 200, headers, body: JSON.stringify({ ok:false, rows, message:'Windy kortalykill er virkur, en Stations/PWS API virðist ekki vera sama þjónusta og Map Forecast API. Veðurstofu-mælingar eru því aðskildar og virka áfram.' }) };
};
