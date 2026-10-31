const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const email of ['', 'test@example.com'])for(const outcome of ['available','missing','network'])test((email?'optional email':'phone only')+' / '+outcome,async()=>{
 const dom=new JSDOM(fs.readFileSync(root+'/sell/index.html','utf8'),{url:'https://stonebridgedg.com/sell/',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;w.AbortSignal=AbortSignal;let submissions=[],drafts=[],lookups=0,leads=0;
 w.fbq=(event,name)=>{if(name==='Lead')leads++;};
 w.fetch=async(url,options)=>{
  const data=JSON.parse(options.body);
  if(url.endsWith('/valuation')){lookups++;if(outcome==='network')throw Error('timeout');return {ok:true,json:async()=>outcome==='available'?{ok:true,available:true,value:250000,preliminary_offer:212500,checked_at:'2026-10-31T12:00:00Z'}:{ok:true,available:false,reason:'no_estimate'}};}
  if(url.endsWith('/draft'))drafts.push(data);else submissions.push(data);
  return {ok:true,json:async()=>({ok:true})};
 };
 w.eval(fs.readFileSync(root+'/assets/sell.js','utf8'));w.eval(fs.readFileSync(root+'/assets/form-autosave.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const $=id=>w.document.getElementById(id);
 const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
 const submit=()=>{$('sellForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 assert.equal(w.document.querySelector('[name="contact_method"]'),null);
 change('address','123 Main St, Troy, MI 48084, USA');submit();await tick();
 assert.equal($('valuationLoading').hidden,true);assert.equal(w.document.querySelector('[data-step="2"]').hidden,false);
 assert.equal($('estimateFigures').hidden,outcome!=='available');
 if(outcome==='available')assert.equal($('offerValue').textContent,'$212,500');else assert.equal($('estimateFallback').hidden,false);
 assert.equal(submissions.length,0);assert.equal(leads,0);
 assert(!w.document.body.textContent.match(/Zillow|Zestimate|UP TO 80%|PREFERRED CONTACT METHOD/));
 $('back').click();submit();await tick();assert.equal(lookups,outcome==='network'?2:1);
 submit();assert.equal(w.document.querySelector('[data-step="2"]').hidden,false);
 change('phone','2485550123');change('email','not-an-email');$('consent').checked=true;submit();assert.equal(w.document.querySelector('[data-step="2"]').hidden,false);
 change('email',email);submit();await tick();
 assert.equal(w.document.querySelector('[data-step="3"]').hidden,false);
 assert(drafts.some(d=>d.phone==='2485550123'&&d.flow_version==='valuation_v2'),'phone saved before remaining questions');
 if(outcome==='available')assert(drafts.some(d=>d.message.includes('$212500')),'shown estimate saved with incomplete lead');
 w.document.querySelector('[data-field="timing"]').click();assert.equal($('next').hidden,true);
 const choice=w.document.querySelector('[data-field="condition"]');choice.click();choice.click();await tick();
 assert.equal(submissions.length,1,'final choice submits once without a submit-button click');assert.equal(submissions[0].contact_method,'phone');assert.equal(submissions[0].email,email);assert.equal(submissions[0].phone,'2485550123');assert.equal(submissions[0].name,'');assert.equal(leads,1);
 assert.equal(w.sessionStorage.getItem('stonebridge:seller-submitted')!==null,true);
 dom.window.close();
});
test('support text follows the form and thank-you page links home',()=>{
 const html=fs.readFileSync(root+'/sell/index.html','utf8');assert(html.indexOf('landing-support')>html.indexOf('</form>'));
 const thanks=new JSDOM(fs.readFileSync(root+'/sell/thank-you/index.html','utf8'));const link=thanks.window.document.querySelector('.explore-button');assert.equal(link.getAttribute('href'),'/');assert(link.textContent.includes('Explore more about StoneBridge'));thanks.window.close();
});
