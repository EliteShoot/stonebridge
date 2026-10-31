// Imported by worker.js. The provider key is used only on the server.
export async function propertyValuation(request, env, origin) {
  const reply = (body, status = 200) => Response.json(body, {status, headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'}});
  const unavailable = reason => reply({ok:true,available:false,reason});
  if (Number(request.headers.get('Content-Length') || 0) > 2048) return reply({error:'Invalid address'},413);
  let data;
  try { data=await request.json(); } catch { return reply({error:'Invalid request'},400); }
  const address=typeof data?.address==='string'?data.address.trim():'';
  if (address.length<8 || address.length>300 || !/\d/.test(address)) return reply({error:'Enter a full property address'},400);
  if (!env.RAPIDAPI_KEY || !env.DB) return unavailable('not_configured');
  const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key=await hash(address.toLowerCase().replace(/[^a-z0-9]/g,''));
  try {
    await env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS sb_valuation_cache (id TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS sb_valuation_usage (id TEXT PRIMARY KEY,count INTEGER NOT NULL)')
    ]);
    const now=Date.now();
    const cached=await env.DB.prepare('SELECT payload FROM sb_valuation_cache WHERE id=? AND expires_at>?').bind(key,now).first();
    if(cached) return reply(JSON.parse(cached.payload));
    // Atomic reservations: concurrent requests cannot exceed the local free-tier budget.
    const reserve=async(id,limit)=>!!await env.DB.prepare('INSERT INTO sb_valuation_usage(id,count) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(id,limit).first();
    const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
    const ip=await hash(request.headers.get('CF-Connecting-IP')||'unknown');
    if(!await reserve('ip:'+day+':'+ip,8)) return unavailable('limit');
    if(!await reserve('month:'+month,900)) return unavailable('limit');
    const url=new URL('https://zillow-full-data-api.p.rapidapi.com/property');
    url.searchParams.set('address',address);url.searchParams.set('fields','zpid,zestimate,address,matchedAddress');
    const response=await fetch(url,{headers:{'X-RapidAPI-Key':env.RAPIDAPI_KEY,'X-RapidAPI-Host':'zillow-full-data-api.p.rapidapi.com'},signal:AbortSignal.timeout(10000)});
    if(!response.ok){console.warn('valuation_provider_status',response.status);return unavailable(response.status===404?'not_found':'provider_unavailable');}
    const raw=await response.json();
    const record=raw?.property||raw?.data||raw;
    const value=record?.zestimate;
    const available=typeof value==='number'&&Number.isFinite(value)&&value>0;
    const result=available?{ok:true,available:true,value:Math.round(value),preliminary_offer:Math.round(value*.8),source:'Zillow Zestimate via HouseData',checked_at:new Date(now).toISOString()}:{ok:true,available:false,reason:'no_estimate'};
    await env.DB.prepare('INSERT INTO sb_valuation_cache(id,payload,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(key,JSON.stringify(result),now+(available?86400000:3600000)).run();
    return reply(result);
  } catch {console.warn('valuation_lookup_unavailable');return unavailable('provider_unavailable');}
}
