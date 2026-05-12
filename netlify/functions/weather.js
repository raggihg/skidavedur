const stations = '2636,2641,2644';
exports.handler = async (event) => {
  const kind = event.queryStringParameters?.kind || 'latest';
  let url;
  if(kind==='latest') url = `https://api.vedur.is/weather/observations/aws/raw/10min/latest?stations=${stations}&parameters=basic`;
  else if(kind==='history24') url = `https://api.vedur.is/weather/observations/aws/hour?stations=2636&parameters=T&time=24h`;
  else if(kind==='forecast24') url = `https://api.vedur.is/weather/forecasts/point?lat=66.0&lon=-23.25`;
  else return {statusCode:400, body:JSON.stringify({error:'unknown kind'})};
  try{
    const r = await fetch(url); const text = await r.text();
    if(!r.ok) throw new Error(`${r.status} ${text.slice(0,120)}`);
    return {statusCode:200, headers:{'content-type':'application/json'}, body:text};
  }catch(e){
    // soft fallback so frontend keeps working
    return {statusCode:200, headers:{'content-type':'application/json'}, body:JSON.stringify({error:e.message, stations:[], hours:null, points:null})};
  }
};
