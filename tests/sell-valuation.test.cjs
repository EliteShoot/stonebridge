const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const mode of ['text','email'])for(const outcome of ['available','missing','network'])test(mode+' / '+outcome,async()=>{
 const dom=new JSDOM(fs.readFileSync(root+'/sell/index.html','utf8'),{url:'https://stonebridgedg.com/sell/',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;w.AbortSignal=AbortSignal;let submissions=[],drafts=[],lookups=0,leads=0;
 w.fbq=(event,name)=>{if(name==='Lead')leads++;};
 w.fetch=async(url,options)=>{
  const data=JSON.parse(options.body);
  if(url.endsWith('/valuation')){lookups++;if(outcome==='network')throw Error('timeout');return {ok:true,json:async()=>outcome==='available'?{ok:true,available:true,value:250000,preliminary_offer:200000,source:'Zillow Zestimate via HouseData'}:{ok:true,available:false,reason:'no_estimate'}};}
  if(url.endsWith('/draft'))drafts.push(data);else submissions.push(data);
  return {ok:true,json:async()=>({ok:true})};
 };
 w.eval(fs.readFileSync(root+'/assets/sell.js','utf8'));w.eval(fs.readFileSync(root+'/assets/form-autosave.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const $=id=>w.document.getElementById(id);
 const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
 const submit=()=>{$('sellForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 change('address','123 Main St, Troy, MI 48084');submit();await tick();
 assert.equal($('valuationLoading').hidden,true);assert.equal(w.document.querySelector('[data-step="2"]').hidden,false);
 assert.equal($('estimateFigures').hidden,outcome!=='available');
 if(outcome==='available')assert.equal($('offerValue').textContent,'$200,000');else assert.equal($('estimateFallback').hidden,false);
 $('back').click();submit();await tick();assert.equal(lookups,outcome==='network'?2:1);
 // Empty contact data cannot advance or fire a conversion.
 submit();assert.equal(w.document.querySelector('[data-step="2"]').hidden,false);assert.equal(leads,0);
 change('name','Test');
 if(mode==='email'){const radio=w.document.querySelector('[value="email"]');radio.checked=true;radio.dispatchEvent(new w.Event('change',{bubbles:true}));change('email','test@example.com');}
 else change('phone','2485550123');
 $('consent').checked=true;submit();await tick();
 assert.equal(w.document.querySelector('[data-step="3"]').hidden,false);
 assert(drafts.some(d=>d.name==='Test'&&(mode==='email'?d.email:d.phone)),'contact saved before remaining questions');
 w.document.querySelector('[data-field="timing"]').click();w.document.querySelector('[data-field="condition"]').click();
 assert.equal(submissions.length,0);submit();await tick();
 assert.equal(submissions.length,1);assert.equal(submissions[0].contact_method,mode);assert.equal(submissions[0].email,mode==='email'?'test@example.com':'');assert.equal(submissions[0].phone,mode==='text'?'2485550123':'');assert.equal(leads,1);
 assert.equal(w.sessionStorage.getItem('stonebridge:seller-submitted')!==null,true);
 dom.window.close();
});
