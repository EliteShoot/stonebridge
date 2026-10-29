import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/sell-thank-you.js',import.meta.url),'utf8');
function visit(receipt, blocked=false) {
  const scripts=[], redirects=[];
  const store=new Map(receipt===null?[]:[['stonebridge:seller-submitted',receipt]]);
  const document={body:{hidden:true},querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild:s=>scripts.push(s.src)}};
  const context={document,location:{replace:url=>redirects.push(url)},sessionStorage:{getItem:k=>{if(blocked)throw Error('blocked');return store.get(k)??null},removeItem:k=>store.delete(k)}};
  context.window=context;
  vm.runInNewContext(source,context);
  return {context,store,scripts,redirects};
}
test('fresh successful submission shows confirmation and sends one Meta pageview',()=>{
  const r=visit(String(Date.now()));
  assert.equal(r.context.document.body.hidden,false);
  assert.equal(r.store.size,0);
  assert.deepEqual(r.redirects,[]);
  assert.equal(r.scripts.length,2);
  assert.deepEqual(Array.from(r.context.fbq.queue[1]),['track','PageView']);
  // A reload has no remaining receipt and must not count again.
  const reload=visit(r.store.get('stonebridge:seller-submitted')??null);
  assert.equal(reload.scripts.length,0);
  assert.deepEqual(reload.redirects,['/sell/']);
});
test('direct, expired, invalid, future and storage-blocked visits never load tracking',()=>{
  for(const receipt of [null,'garbage',String(Date.now()-601000),String(Date.now()+60000)]) {
    const r=visit(receipt);
    assert.equal(r.context.document.body.hidden,true);
    assert.equal(r.scripts.length,0);
    assert.deepEqual(r.redirects,['/sell/']);
  }
  const blocked=visit(null,true);
  assert.equal(blocked.scripts.length,0);
  assert.deepEqual(blocked.redirects,['/sell/']);
});
