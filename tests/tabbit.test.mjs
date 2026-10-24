import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserPort,manifest} from '../slots/browsers/tabbit/adapter.mjs';
import {negotiate} from '../slots/protocol.mjs';
import {createSiteSlot as jdCampus} from '../slots/sites/jd-campus/adapter.mjs';

function fixture() {
  const state={url:'https://jobs.example.test/list',text:'岗位列表',clicks:0,reloads:0,handoffs:0,popup:null};
  const target={index:0,text:'工程师',label:'',tag:'BUTTON',type:null,visible:true,disabled:false};
  const locator={nth:()=>locator,first:()=>locator,filter:()=>locator,waitFor:async()=>{if(state.waitError)throw Error('timeout');},click:async()=>{state.clicks++;if(state.popup)owned.push(state.popup);},fill:async value=>{state.value=value;},pressSequentially:async value=>{state.value+=value;},press:async key=>{state.key=key;}};
  const page={url:()=>state.url,evaluate:async()=>({text:state.text,fields:{},lists:{},controls:{'.job':[{...target}]}}),locator:()=>locator,goto:async url=>{state.url=url;},reload:async()=>{state.reloads++;},screenshot:async()=>({image:true}),waitForLoadState:async()=>{},waitForFunction:async(fn,args)=>{state.waitedFor=args.previousText;}};
  const owned=[page];
  const runtime={getPage:()=>page,context:{pages:()=>owned},tabbit:{triggerAndObserve:async fn=>fn()},usePage:p=>{state.selected=p;},reportIssue:()=>{state.handoffs++;}};
  return {state,target,page,owned,runtime,port:createBrowserPort(runtime,['jobs.example.test'])};
}
test('Tabbit requires the official task runtime and satisfies site capabilities',async()=>{
  assert.equal((await createBrowserPort({},[]).connect()).gate,'WAIT_USER');
  assert.equal((await createBrowserPort({getPage:()=>({})},[]).connect()).code,'MISSING_CAPABILITY');
  const f=fixture();assert.equal((await f.port.connect()).gate,'PASS');
  assert.equal(negotiate({protocol_version:1,requires:['navigate','observe','click','fill','wait']},manifest).gate,'PASS');
});
test('navigation reloads unchanged lists and rejects redirects outside declared domains',async()=>{
  const f=fixture();await f.port.connect();
  await f.port.navigate(f.state.url,{reload:true});assert.equal(f.state.reloads,1);
  assert.equal((await f.port.navigate('https://evil.example/')).code,'DOMAIN_REJECTED');
  f.page.goto=async()=>{f.state.url='https://evil.example/';};
  assert.equal((await f.port.navigate('https://jobs.example.test/detail')).code,'DOMAIN_REJECTED');
});
test('stale, missing, changed and application controls never execute',async()=>{
  const f=fixture();await f.port.connect();
  let o=await f.port.observe({controls:['.job']});
  const act=(snapshot=o.data.snapshot_id)=>f.port.act({kind:'click',selector:'.job',snapshot_id:snapshot});
  assert.equal((await act(999)).code,'STALE_OBSERVATION');
  assert.equal((await f.port.act({kind:'click',selector:'.unknown',snapshot_id:o.data.snapshot_id})).code,'UNOBSERVED_TARGET');
  f.target.text='another job';assert.equal((await act()).code,'STALE_OBSERVATION');
  for(const patch of [{text:'立即申请'},{text:'',label:'提交申请'},{text:'工程师',label:'',type:'submit'},{type:'password'}]) {
    Object.assign(f.target,patch);o=await f.port.observe({controls:['.job']});assert.equal((await act()).code,'OUTSIDE_COLLECTION_SCOPE');
  }
  assert.equal(f.state.clicks,0);
});
test('popup is adopted only after domain checks; old snapshots expire',async()=>{
  const f=fixture();await f.port.connect();
  const o=await f.port.observe({controls:['.job']});
  f.state.popup={...f.page,url:()=> 'https://jobs.example.test/detail'};
  const action={kind:'click',selector:'.job',snapshot_id:o.data.snapshot_id};
  assert.equal((await f.port.act(action)).data.url,'https://jobs.example.test/detail');
  assert.equal(f.state.selected,f.state.popup);
  assert.equal((await f.port.act(action)).code,'STALE_OBSERVATION');
  const bad=fixture();await bad.port.connect();const b=await bad.port.observe({controls:['.job']});
  bad.state.popup={...bad.page,url:()=> 'https://evil.example/'};
  assert.equal((await bad.port.act({...action,snapshot_id:b.data.snapshot_id})).code,'DOMAIN_REJECTED');assert.equal(bad.state.selected,undefined);
});
test('search fill and Enter work; login handoff preserves tabs',async()=>{
  const f=fixture();await f.port.connect();Object.assign(f.target,{tag:'INPUT',type:'search',text:''});
  let o=await f.port.observe({controls:['.job']});
  await f.port.act({kind:'fill',selector:'.job',value:'Agent',snapshot_id:o.data.snapshot_id});assert.equal(f.state.value,'Agent');
  o=await f.port.observe({controls:['.job']});await f.port.act({kind:'press',selector:'.job',key:'Enter',snapshot_id:o.data.snapshot_id});assert.equal(f.state.key,'Enter');
  f.state.waitError=true;f.state.text='请先登录';
  assert.equal((await f.port.wait({selector:'.job'})).code,'LOGIN_OR_CHALLENGE');
  await f.port.handoff();assert.equal(f.state.handoffs,1);
  assert.deepEqual(await f.port.screenshot(),{image:true});
  await f.port.release();assert.equal(f.owned.length,1);assert.equal((await f.port.observe()).code,'CONNECT_REQUIRED');
});
test('popup transition rejects an external URL even before the tab inventory catches up',async()=>{
  const f=fixture();await f.port.connect();
  f.runtime.tabbit.triggerAndObserve=async (fn,options)=>{assert.equal(options.settleMs,1000);await fn();return {kind:'page',url:'https://evil.example/'};};
  let o=await f.port.observe({controls:['.job']});
  assert.equal((await f.port.act({kind:'click',selector:'.job',snapshot_id:o.data.snapshot_id})).code,'DOMAIN_REJECTED');
  f.runtime.tabbit.triggerAndObserve=async()=>({kind:'page',url:'https://jobs.example.test/detail'});
  o=await f.port.observe({controls:['.job']});
  assert.equal((await f.port.act({kind:'click',selector:'.job',snapshot_id:o.data.snapshot_id})).code,'PAGE_CHANGED');
});
test('JD campus waits for search replacement instead of returning the old list',async()=>{
  let submitted=false,stuck=false;
  const waits=[];
  const observation=()=>({gate:'PASS',data:{url:'https://campus.jd.com/home#/jobs',text:'合成岗位',snapshot_id:1,lists:{jobs:[{index:0,text:submitted&&!stuck?'合成算法岗位':'合成仓储岗位',title:submitted&&!stuck?'算法工程师':'仓储经理'}],pages:[{text:'1'}]},controls:{}}});
  const port={navigate:async()=>{submitted=false;return observation();},observe:async()=>observation(),act:async a=>{if(a.kind==='press')submitted=true;return observation();},wait:async spec=>{waits.push(spec);return stuck&&spec.previousText?{gate:'RETRY',code:'BROWSER_ERROR'}:observation();}};
  const result=await jdCampus(port).discover({keyword:'算法'});
  assert.equal(result.data.refs[0].title,'算法工程师');
  assert.ok(waits.some(w=>w.previousText==='合成仓储岗位'));
  stuck=true;assert.equal((await jdCampus(port).discover({keyword:'算法'})).gate,'RETRY');
});
