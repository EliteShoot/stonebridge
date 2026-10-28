import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import worker from '../worker.js';

function database() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE leads(id TEXT PRIMARY KEY,created_at TEXT,type TEXT,name TEXT,email TEXT,phone TEXT,address TEXT,timing TEXT,condition TEXT,property TEXT,subject TEXT,message TEXT,consent INTEGER,status TEXT DEFAULT 'New',email_status TEXT DEFAULT 'pending')`);
  const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values)},async run(){return {meta:sqlite.prepare(sql).run(...args)}},async first(){return sqlite.prepare(sql).get(...args)},async all(){return {results:sqlite.prepare(sql).all(...args)}}});
  return {sqlite,DB:{prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}}};
}
const origin='https://stonebridgedg.com';
const draft=(id,revision,extra={})=>({draft_id:id,revision,type:'seller',address:'123 Main St, Detroit, MI',...extra});
const send=(env,path,data,source=origin)=>worker.fetch(new Request('https://stonebridge.psznbzhnps.workers.dev'+path,{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(data)}),env,{waitUntil(p){return p}});

test('partial leads: ordered updates, origin checks, validation, completion and late exit flush',async()=>{
  const {sqlite,DB}=database();const env={DB,RESEND_API_KEY:'test'};const id=crypto.randomUUID();
  assert.equal((await send(env,'/draft',draft(id,1))).status,200);
  assert.equal(sqlite.prepare('SELECT status FROM leads').get().status,'Incomplete');
  await send(env,'/draft',draft(id,3,{name:'Newest',consent:false}));
  await send(env,'/draft',draft(id,2,{name:'Stale',consent:true}));
  let lead=sqlite.prepare('SELECT * FROM leads').get();assert.equal(lead.name,'Newest');assert.equal(lead.consent,0);assert.equal(lead.email_status,'not_sent');
  assert.equal((await send(env,'/draft',draft(id,4),'https://other.example')).status,403);
  assert.equal((await send(env,'/draft',draft(id,4,{address:''}))).status,400);
  assert.equal((await send(env,'/draft',draft(id,4,{name:'x'.repeat(121)}))).status,400);
  assert.equal((await send({},'/draft',draft(id,4))).status,503);
  const actualFetch=globalThis.fetch;let emails=0;
  globalThis.fetch=async()=>{emails++;return Response.json({id:'test'})};
  try {
    const final={draft_id:id,name:'Final Name',email:'test@example.com',phone:'2488008100',address:'123 Main St, Detroit, MI',timing:'Within 30 days',condition:'Needs some work',consent:true};
    assert.equal((await send(env,'/',final)).status,200);
    lead=sqlite.prepare('SELECT * FROM leads').get();assert.equal(lead.status,'New');assert.equal(lead.name,'Final Name');
    await send(env,'/draft',draft(id,10,{name:'Late exit'}));
    assert.equal(sqlite.prepare('SELECT name FROM leads').get().name,'Final Name');
    const before=emails;assert.equal((await send(env,'/',final)).status,200);assert.equal(emails,before);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM leads').get().count,1);
  } finally {globalThis.fetch=actualFetch;sqlite.close()}
});

test('every public form captures partial data in a browser',{skip:process.env.RUN_BROWSER_TESTS!=='1'},async()=>{
  const {chromium}=createRequire(import.meta.url)('playwright');
  const browser=await chromium.launch({headless:true});
  const {sqlite,DB}=database();
  try {
    const context=await browser.newContext();
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.hostname==='stonebridge.psznbzhnps.workers.dev') {
        const response=await send({DB},url.pathname,req.postDataJSON());
        return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
      }
      if(url.origin!==origin)return route.abort();
      try {
        let path=url.pathname==='/'?'/index.html':url.pathname;
        if(path.endsWith('/'))path+='index.html';
        const body=readFileSync(new URL('..'+path,import.meta.url));
        await route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
      }catch{await route.fulfill({status:404,body:''})}
    });
    const files=readdirSync(new URL('..',import.meta.url)).filter(f=>f.endsWith('.html')&&f!=='admin.html'&&readFileSync(new URL('../'+f,import.meta.url),'utf8').includes('workers.dev'));
    files.push('sell/index.html');
    for(const file of files) {
      const page=await context.newPage();
      await page.goto(origin+'/'+file);
      await page.waitForFunction(()=>!!window.StoneBridgeDrafts);
      if(file==='contact.html') {
        for(const modal of ['propertyModal','generalModal']) {
          await page.evaluate(id=>document.getElementById(id).classList.add('open'),modal);
          const form=page.locator('#'+modal+' form');
          await form.locator('[name="Name"]').fill('Partial Contact');
          await assertSaved(page,sqlite,form,'name','Partial Contact');
          if(modal==='propertyModal') {
            await form.locator('[name="Property"]').fill('456 Property St');
            await assertSaved(page,sqlite,form,'property','456 Property St');
          }
          await page.evaluate(id=>document.getElementById(id).classList.remove('open'),modal);
        }
      }else {
        const root=page.locator('#sellForm,.submission-card').first();
        await root.locator('#address').fill('123 Main St, Detroit, MI');
        await assertSaved(page,sqlite,root,'address','123 Main St, Detroit, MI');
        // A choice updates the existing lead even when the next step is hidden.
        await page.evaluate(()=>{
          const b=document.querySelector('[data-field="timing"]');
          b.click();
        });
        await assertSaved(page,sqlite,root,'timing','As soon as possible');
      }
      await page.close();
    }
    console.log(`Verified ${files.length-1} seller pages and both contact forms`);
    await context.close();
  } finally {await browser.close();sqlite.close()}
});
async function assertSaved(page,sqlite,root,key,value) {
  const id=await root.evaluate(el=>window.StoneBridgeDrafts.id(el));
  for(let i=0;i<80;i++) {
    const row=sqlite.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if(row?.[key]===value){assert.equal(row.status,'Incomplete');return}
    await page.waitForTimeout(50);
  }
  assert.fail('Partial save failed for '+page.url()+' field '+key);
}

 test('all public form pages include autosave and final lead linkage',()=>{
 const files=readdirSync(new URL('..',import.meta.url)).filter(f=>f.endsWith('.html')&&f!=='admin.html'&&/<(?:form|input)\b/i.test(readFileSync(new URL('../'+f,import.meta.url),'utf8')));
 for(const f of [...files,'sell/index.html']) {
   const html=readFileSync(new URL('../'+f,import.meta.url),'utf8');
   assert.match(html,/assets\/form-autosave\.js/,f);
   if(f!=='sell/index.html')assert.match(html,/draft_id:window\.StoneBridgeDrafts\?\.id/,f);
 }
 const admin=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 assert.match(admin,/<option>Incomplete<\/option>/);
 console.log('Autosave coverage: '+files.length+' public pages plus /sell/');
 });
