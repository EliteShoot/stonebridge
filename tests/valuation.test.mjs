import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {propertyValuation} from '../valuation.js';
import worker from '../worker.js';
import {extractOfferDetails,offerSnapshot} from '../lead-offer.js';
const db=new DatabaseSync(':memory:');
db.exec("CREATE TABLE leads (id TEXT PRIMARY KEY,created_at TEXT,type TEXT,name TEXT,email TEXT,phone TEXT,address TEXT,timing TEXT,condition TEXT,property TEXT,subject TEXT,message TEXT,consent INTEGER,status TEXT,email_status TEXT)");
const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};},async batch(items){for(const i of items)await i.run();}};
const request=(address='123 Main St, Troy, MI 48084')=>new Request('https://test/valuation',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({address})});
const env={DB,RAPIDAPI_KEY:'test-only'};
test('valuation caches actual estimates, preserves null values, and enforces atomic quota',async()=>{
 let calls=0;const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(new URL(url).hostname,'zillow-full-data-api.p.rapidapi.com');assert.equal(new URL(url).searchParams.get('address'),'123 Main St, Troy, MI 48084');assert.equal(opts.headers['X-RapidAPI-Key'],'test-only');return Response.json({zestimate:250000});};
 try {
  let result=await (await propertyValuation(request('123 Main St, Troy, MI 48084, USA'),env,'https://stonebridgedg.com')).json();assert.equal(result.preliminary_offer,212500);
  await propertyValuation(request(),env,'https://stonebridgedg.com');assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({zestimate:null,price:999999});
  result=await (await propertyValuation(request('124 Main St, Troy, MI 48084'),env,'https://stonebridgedg.com')).json();assert.equal(result.available,false);assert.equal(result.value,undefined);
  globalThis.fetch=async()=>new Response('{}',{status:403});
  result=await (await propertyValuation(request('125 Main St, Troy, MI 48084'),env,'https://stonebridgedg.com')).json();assert.equal(result.available,false);
  const month=new Date().toISOString().slice(0,7);db.prepare('UPDATE sb_valuation_usage SET count=899 WHERE id=?').run('month:'+month);
  globalThis.fetch=async()=>{calls++;return Response.json({zestimate:100000});};const before=calls;
  const results=await Promise.all([126,127].map(n=>propertyValuation(request(n+' Main St, Troy, MI 48084'),env,'https://stonebridgedg.com')));
  const bodies=await Promise.all(results.map(r=>r.json()));assert.equal(calls-before,1);assert.equal(bodies.filter(r=>r.reason==='limit').length,1);
 }finally{globalThis.fetch=original;}
});
test('rejects bad addresses without using the provider',async()=>{assert.equal((await propertyValuation(request('bad'),env,'https://stonebridgedg.com')).status,400);});
test('text-only seller submission requires consent and never sends an acknowledgment to a blank email',async()=>{
 const original=globalThis.fetch;let sent=[];
 globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'mock'});};
 const payload={flow_version:'valuation_v1',contact_method:'text',name:'Test',phone:'2485550123',email:'',address:'123 Main St, Troy MI',timing:'Just exploring',condition:'Needs some work',consent:true};
 const req=d=>new Request('https://worker/',{method:'POST',headers:{Origin:'https://stonebridgedg.com','Content-Type':'application/json'},body:JSON.stringify(d)});
 try{
  let r=await worker.fetch(req(payload),{RESEND_API_KEY:'test'});assert.equal(r.status,200);assert.equal(sent.length,1);assert.equal(sent[0].reply_to,undefined);assert(sent[0].html.includes('Preferred contact: text'));
  r=await worker.fetch(req({...payload,consent:false}),{RESEND_API_KEY:'test'});assert.equal(r.status,400);
  r=await worker.fetch(req({...payload,flow_version:undefined}),{RESEND_API_KEY:'test'});assert.equal(r.status,400);assert.equal(sent.length,1);
 }finally{globalThis.fetch=original;}
});


test('cached values recalculate at 85% and lead snapshots preserve the displayed amount',async()=>{
 const result=await (await propertyValuation(request(),env,'https://stonebridgedg.com')).json();assert.equal(result.preliminary_offer,212500);assert.equal(result.source,undefined);
 const message=await offerSnapshot(env,'123 Main St, Troy, MI 48084, USA');const details=extractOfferDetails(message);assert.equal(details.amount,212500);assert.equal(details.contact_method,'phone');assert.equal(details.property_value,250000);
 assert.equal(extractOfferDetails('Preferred contact: email. Preliminary value shown: $250000; 80% preliminary figure: $200000.').amount,200000);
 assert.equal(extractOfferDetails('Preferred contact: text.').contact_method,'text');
});
test('phone flow permits an optional name and email, and uses the server estimate in notifications',async()=>{
 const original=globalThis.fetch;let sent=[];globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'mock'});};
 const payload={flow_version:'valuation_v2',contact_method:'phone',name:'',phone:'2485550123',email:'',address:'123 Main St, Troy, MI 48084, USA',timing:'Just exploring',condition:'Needs some work',consent:true,message:'FORGED $99999999'};
 const req=d=>new Request('https://worker/',{method:'POST',headers:{Origin:'https://stonebridgedg.com','Content-Type':'application/json'},body:JSON.stringify(d)});
 try{
  const r=await worker.fetch(req(payload),{DB,RESEND_API_KEY:'test'});assert.equal(r.status,200);assert.equal(sent.length,1);assert(sent[0].html.includes('$212500'));assert(!sent[0].html.includes('FORGED'));const stored=db.prepare('SELECT message FROM leads WHERE address=?').get(payload.address);assert.equal(extractOfferDetails(stored.message).amount,212500);
  assert.equal((await worker.fetch(req({...payload,email:'invalid'}),{DB,RESEND_API_KEY:'test'})).status,400);
  assert.equal((await worker.fetch(req({...payload,phone:''}),{DB,RESEND_API_KEY:'test'})).status,400);
 }finally{globalThis.fetch=original;}
});
test('admin page embeds valid offer details and retains legacy contact preferences',async()=>{
 const response=await worker.fetch(new Request('https://worker/admin'),{});const html=await response.text();assert(html.includes('id="offerSummary"'));assert(html.includes('PRELIMINARY CASH ESTIMATE SHOWN'));
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))new Function(script[1]);
 assert.equal(extractOfferDetails('Preferred contact: email.').contact_method,'email');
});
