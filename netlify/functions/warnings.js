exports.handler = async () => {
  const urls = ['https://api.vedur.is/weather/alerts/active','https://api.vedur.is/weather/cap/alerts/active'];
  for(const url of urls){
    try{ const r=await fetch(url); const text=await r.text(); if(r.ok) return {statusCode:200, headers:{'content-type':'application/json'}, body:text}; }catch(e){}
  }
  return {statusCode:200, headers:{'content-type':'application/json'}, body:JSON.stringify({warnings:[]})};
};
