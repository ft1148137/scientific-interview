import test from 'node:test';
import assert from 'node:assert/strict';
import {createSiteSlot,manifest} from '../slots/sites/jd/adapter.mjs';
import {createBrowserPort,manifest as browserManifest} from '../slots/browsers/codex-chrome/adapter.mjs';
import {runScan} from '../slots/runner.mjs';
import {gate} from '../slots/protocol.mjs';
import {sections,pairedSections} from '../slots/sites/shared/dom-site.mjs';
const ok=data=>gate('PASS','OBSERVED','',{data});
function jdFixture({changed=false,blocked=false}={}) {
 let page=1,seq=0,selected='101';const actions=[];
 const cards=()=>[101,102].map((id,index)=>({index,external_id:String(id),title:'合成职位'+id,location:'合成城市',text:'合成卡片'+id}));
 const data=()=>({url:manifest.entry_url,text:'合成账号栏',snapshot_id:++seq,observed_at:'2026-10-22T00:00:00Z',fields:{},lists:{},controls:{}});
 const port={manifest:browserManifest,
  navigate:async()=>{page=1;return ok(data());},observe:async()=>ok(data()),
  wait:async spec=>{const d=data();
   if(spec.observe?.lists?.jobs){d.lists={jobs:cards(),pages:[{text:'1'},{text:'2'}]};}
   if(spec.observe?.lists?.sections){d.fields.title=changed?'错误职位':'合成职位'+selected;d.lists.sections=[{heading:'岗位描述：',text:'岗位描述：\n合成职责'},{heading:'任职要求：',text:'任职要求：\n合成要求'}];}
   return blocked?ok({...d,text:'请先登录'}):ok(d);},
  act:async action=>{actions.push(action);const match=action.selector.match(/recrequirementid="(\d+)"/);if(match)selected=match[1];return ok(data());}};
 return {port,site:createSiteSlot(port),actions};
}
test('JD expands the observed arrow and saves two distinct jobs sharing a URL',async()=>{
 const f=jdFixture();const scan=await runScan(f.port,f.site,{keyword:'合成'},{maxJobs:2});assert.equal(scan.records.length,2);assert.deepEqual(scan.seen_ids,['101','102']);assert.deepEqual(scan.seen_urls,[]);assert.equal(scan.records[0].url,scan.records[1].url);assert.ok(scan.records.every(r=>r.jd_complete));assert.ok(scan.records.every(r=>!r.evidence.text.includes('账号栏')));assert.ok(f.actions.some(a=>a.selector.endsWith('b.drop-down')));assert.ok(!f.actions.some(a=>a.selector.endsWith('a.apply-btn')));
});
test('shared URL checkpoint resumes by ID and reads only the remaining job',async()=>{
 const f=jdFixture();const first=await runScan(f.port,f.site,{keyword:'合成'},{maxJobs:1});const second=await runScan(f.port,f.site,{keyword:'合成'},{maxJobs:1,checkpoint:first.checkpoint});assert.deepEqual(second.records.map(r=>r.external_id),['102']);assert.deepEqual(second.checkpoint.completed_ids,['101','102']);
});
test('JD validates the inline record identity and handles login interruption',async()=>{
 const f=jdFixture({changed:true});const ref=(await f.site.discover({keyword:'合成'})).data.refs[0];assert.equal((await f.site.readJob(ref)).code,'IDENTITY_CHANGED');assert.equal((await f.site.readJob({...ref,external_id:'1"]body'})).code,'INVALID_REF');assert.equal((await jdFixture({blocked:true}).site.discover({keyword:'合成'})).gate,'WAIT_USER');
});
test('legacy URL checkpoints remain resumable and malformed ID checkpoints reject',async()=>{
 const f=jdFixture();const cp={protocol_version:1,source:'jd',slot_version:'1.0.0',query:{},completed_urls:[]};assert.equal((await runScan(f.port,f.site,{}, {checkpoint:cp,maxJobs:1})).records.length,1);assert.equal((await runScan(f.port,f.site,{}, {checkpoint:{...cp,completed_ids:'bad'}})).code,'INVALID_CHECKPOINT');
});
test('same job ID with a changed URL is not duplicated',async()=>{
 const refs=[{external_id:'1',url:'https://example.com/a'},{external_id:'1',url:'https://example.com/b'}];const site={manifest,discover:async()=>ok({refs,next_cursor:null}),readJob:async r=>ok(r)};const scan=await runScan({manifest:browserManifest},site);assert.equal(scan.records.length,1);
});
test('section headings without body and mismatched blocks cannot be complete',()=>{
 assert.equal(sections({fields:{title:'合成'},lists:{sections:[{heading:'岗位描述：',text:'岗位描述：'},{heading:'任职要求：',text:'任职要求：\n有要求'}]}}).complete,false);
 assert.equal(pairedSections({fields:{title:'合成'},lists:{headings:[{text:'工作职责'},{text:'任职资格'}],blocks:[{text:'职责'}]}}).complete,false);
});
test('Enter is restricted to observed text/search inputs and blocked for passwords',async()=>{
 for(const type of ['text','search','password','file']){
  let presses=0;const target={index:0,tag:'INPUT',type,visible:true,text:''};
  const tab={id:'test',url:async()=> 'https://example.com',getAXState:async()=>'',playwright:{evaluate:async()=>({text:'测试',controls:{input:[target]}}),locator:()=>({nth:()=>({press:async()=>{presses++;}})})}};
  const cua={listBrowsers:async()=>[{id:'test',family:'chrome',type:'extension'}],createBrowserTab:async()=>tab,listTabs:async()=>[{id:'test',url:'https://example.com'}]};
  const port=createBrowserPort(cua,['example.com']);await port.connect();const observed=await port.navigate('https://example.com');const result=await port.act({kind:'press',key:'Enter',selector:'input',snapshot_id:observed.data.snapshot_id});assert.equal(result.gate,['text','search'].includes(type)?'PASS':'REJECT');assert.equal(presses,['text','search'].includes(type)?1:0);
 }
});
test('browser reads IDs only from visible elements and rejects non-ID secret attributes',async()=>{
 const {runInNewContext}=await import('node:vm');
 const make=visible=>({innerText:'合成岗位',parentElement:null,getBoundingClientRect:()=>({width:visible?10:0,height:visible?10:0}),getAttribute:name=>name==='recrequirementid'?'101':null});
 const visible=make(true),hidden=make(false),document={body:{innerText:'合成页面'},querySelectorAll:selector=>selector==='.card'?[visible]:[hidden]};
 const tab={id:'test',url:async()=> 'https://example.com',playwright:{locator:()=>{},evaluate:async(fn,arg)=>runInNewContext('('+fn.toString()+')(arg)',{document,arg,getComputedStyle:()=>({webkitLineClamp:'none'})})}};
 const cua={listBrowsers:async()=>[{id:'test',family:'chrome',type:'extension'}],createBrowserTab:async()=>tab};
 const port=createBrowserPort(cua,['example.com']);await port.connect();await port.navigate('https://example.com');
 const result=await port.observe({fields:{job:{selector:'.card',attribute:'recrequirementid'},hidden:{selector:'.hidden',attribute:'recrequirementid'}}});
 assert.equal(result.data.fields.job,'101');assert.equal(result.data.fields.hidden,null);
 const rejected=await port.observe({fields:{bad:{selector:'.card',attribute:'data-token'}}});assert.equal(rejected.gate,'RETRY');assert.match(rejected.message,/UNSUPPORTED_ATTRIBUTE/);
});
