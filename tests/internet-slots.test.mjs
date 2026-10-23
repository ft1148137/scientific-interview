import test from 'node:test';
import assert from 'node:assert/strict';
import {gate} from '../slots/protocol.mjs';
import {runScan} from '../slots/runner.mjs';
import {createBrowserPort,manifest as browserManifest} from '../slots/browsers/codex-chrome/adapter.mjs';
import {completeMokaJD} from '../slots/sites/shared/moka.mjs';

// All observations in this file are synthetic; no network or personal data.
const ids=['meituan','amap','bytedance','moka-kimi','moka-zhipu','moka-step','xiaohongshu','kuaishou','didi'];
const modules=Object.fromEntries(await Promise.all(ids.map(async id=>[id,await import(`../slots/sites/${id}/adapter.mjs`)])));
function fixture(id, options={}) {
  const module=modules[id],m=module.manifest;
  const url=id==='xiaohongshu'?'https://job.xiaohongshu.com/social/position/123':id==='kuaishou'?'https://zhaopin.kuaishou.cn/#/official/social/job-info/123':id==='didi'?'https://talent.didiglobal.com/social/jobDetail?jdId=123':id==='meituan'?'https://zhaopin.meituan.com/web/position/detail?jobUnionId=123':id==='amap'?'https://talent.amap.com/off-campus/position-detail?lang=zh&positionId=123':id==='bytedance'?'https://jobs.bytedance.com/experienced/position/123/detail':m.entry_url.replace('#/jobs','#/job/synthetic-123');
  const title='合成工程师',jd='岗位职责\n负责合成示例系统的设计、开发、测试和交付，维护质量并改进文档。\n任职要求\n理解软件工程，能够独立分析问题、验证方案并与团队协作。';
  let current=m.entry_url,page=1,sequence=0;
  const log=[];
  function observation(detail=false) {
    return gate('PASS','OBSERVED','',{data:{url:current,text:'合成账户页眉，请勿写入证据',observed_at:'2026-10-22T00:00:00Z',snapshot_id:++sequence,fields:detail?{title:options.title || title,jd,location:'合成城市'}:{},lists:detail?{sections:[{heading:'岗位职责',text:'岗位职责\n合成职责'},{heading:'任职要求',text:'任职要求\n合成要求'}],headings:[{text:'职位描述'},{text:'职位要求'}],blocks:[{text:'合成职责'},{text:'合成要求'}]}:{jobs:[{index:0,text:page===1?'合成卡片一':'合成卡片二',title,location:'合成城市',meta:'全职 | 合成城市',...(id.startsWith('moka')||['bytedance','xiaohongshu'].includes(id)?{href:options.href || url}:{})}],pages:options.noPagination?[]:[{text:'1'},{text:'2'}]},clipped_fields:options.clipped?['jd']:[],controls:{}}});
  }
  const port={manifest:browserManifest,
    observe:async()=>observation(),
    navigate:async(target,opts)=>{log.push({op:'navigate',target,opts});current=options.redirect || target;if(opts?.reload)page=1;return observation();},
    wait:async spec=>{log.push({op:'wait',spec});if(options.challenge)return gate('PASS','OK','',{data:{text:'请先登录',url:current}});const detail=!spec.observe?.lists?.jobs;const result=observation(detail);for(const selector of spec.observe?.controls || [])result.data.controls[selector]=options.noPagination?[]:[{index:0,visible:true,disabled:options.lastPage || page===2}];return result;},
    act:async action=>{log.push({op:'act',action});if(action.kind==='fill'||action.kind==='press'||action.selector.includes('input-search-button'))return observation();if(action.selector.includes('Pagination')||action.selector.includes('pagination')){if(!options.stuck)page++;}else current=url;return observation();}
  };
  return {port,site:module.createSiteSlot(port),url,title,jd,log};
}
for(const id of ids)test(`${id}: list, identity, JD and scoped evidence`,async()=>{
  const f=fixture(id);const found=await f.site.discover({keyword:'工程师'});assert.equal(found.gate,'PASS');assert.equal(found.data.refs.length,1);assert.deepEqual(found.data.next_cursor,{page:2});
  const read=await f.site.readJob(found.data.refs[0]);assert.equal(read.gate,'PASS',read.code);assert.equal(read.data.company,modules[id].manifest.company);assert.ok(read.data.external_id);assert.equal(read.data.jd_complete,true);assert.ok(read.data.evidence.text.includes('合成'));assert.ok(!read.data.evidence.text.includes('账户页眉'));assert.equal(read.data.evidence.url,read.data.url);
});
test('Moka rejects a different tenant on the same host before navigating',async()=>{
  const f=fixture('moka-kimi');const r=await f.site.readJob({url:modules['moka-zhipu'].manifest.entry_url.replace('#/jobs','#/job/synthetic-123')});assert.equal(r.code,'SITE_SCOPE_REJECTED');assert.equal(f.log.length,0);
});
test('Moka rejects cross-tenant links and redirected tenant pages',async()=>{
  const bad=modules['moka-zhipu'].manifest.entry_url.replace('#/jobs','#/job/synthetic-123');assert.equal((await fixture('moka-kimi',{href:bad}).site.discover({})).code,'SITE_SCOPE_REJECTED');assert.equal((await fixture('moka-kimi',{redirect:bad}).site.discover({})).code,'SITE_SCOPE_REJECTED');
});
test('title mismatch rejects detail and unknown query fields are not silently ignored',async()=>{
 const f=fixture('bytedance',{title:'不同职位'});assert.equal((await f.site.readJob({url:f.url,title:f.title})).code,'IDENTITY_CHANGED');assert.equal((await f.site.discover({keyword:'x',city:'北京'})).code,'UNSUPPORTED_QUERY');
});
test('clamped JD remains incomplete',async()=>{
 const f=fixture('moka-step',{clipped:true});assert.equal((await f.site.readJob({url:f.url})).data.jd_complete,false);
});
test('Moka supports observed heading variants and rejects missing requirement bodies',()=>{
 const body='合成职责：设计、开发和测试系统，维护代码并根据结果不断改进实现。';
 for(const [a,b] of [['【岗位职责】','【任职资格】'],['你会亲手打造','我们在找谁'],['你将参与构建','以下满足其一即可：'],['Responsibilities','Requirements']])assert.equal(completeMokaJD(`${a}\n${body}\n${b}\n${body}`),true);
 assert.equal(completeMokaJD(`岗位职责\n${body}\n任职要求\n`),false);assert.equal(completeMokaJD(body),false);
});
test('pagination replays from a reset list and detects unchanged content',async()=>{
 const f=fixture('amap');assert.equal((await f.site.discover({},{page:2})).gate,'PASS');assert.equal(f.log[0].opts.reload,true);assert.equal(f.log.filter(x=>x.op==='wait')[1].spec.previousText,'合成卡片一');
 assert.equal((await fixture('amap',{stuck:true}).site.discover({},{page:2})).code,'PAGE_NOT_CHANGED');
 assert.equal((await fixture('moka-step',{lastPage:true}).site.discover({})).data.next_cursor,null);
});
test('Amap scopes main results and Moka excludes latest-job recommendations',async()=>{
 const f=fixture('amap');await f.site.discover({});assert.match(f.log.find(x=>x.op==='wait').spec.selector,/lDOIT.* > /);
 const m=fixture('moka-step');await m.site.discover({});assert.equal(m.log.find(x=>x.op==='wait').spec.selector,'[class*="jobs-"] a[href*="#/job/"]');
});
test('missing pagination never claims complete coverage in the runner',async()=>{
 const f=fixture('moka-step',{noPagination:true});const scan=await runScan(f.port,f.site,{});assert.equal(scan.records.length,1);assert.equal(scan.coverage,'partial');assert.equal(scan.checkpoint,null);
});
test('login after rendering propagates WAIT_USER',async()=>{assert.equal((await fixture('amap',{challenge:true}).site.discover({})).gate,'WAIT_USER');});
test('a reordered non-link card is rejected rather than opening the wrong job',async()=>{
 const f=fixture('meituan');const ref=(await f.site.discover({})).data.refs[0];ref.card_text='另一张卡片';assert.equal((await f.site.readJob(ref)).code,'LIST_CHANGED');assert.equal(f.log.some(x=>x.op==='act'),false);
});
function browserFixture(target, pageText='岗位') {
 let clicks=0,reloads=0;
 const tab={id:'test',url:async()=> 'https://example.com/jobs',reload:async()=>{reloads++;},getAXState:async()=>'',playwright:{evaluate:async()=>({text:pageText,fields:{},lists:{},controls:{button:[target]}}),locator:()=>({nth:()=>({click:async()=>{clicks++;}}),first:()=>({waitFor:async()=>{throw new Error('timeout');}})})}};
 const cua={listBrowsers:async()=>[{id:'test',family:'chrome',type:'extension'}],createBrowserTab:async()=>tab,listTabs:async()=>[{id:'test',url:'https://example.com/jobs'}]};
 return {port:createBrowserPort(cua,['example.com']),counts:()=>({clicks,reloads})};
}
test('browser allows observed icon buttons, rejects disabled/hidden/submission targets',async()=>{
 for(const target of [{index:0,text:'',tag:'BUTTON',visible:true,type:'button',disabled:false},{index:0,text:'',tag:'BUTTON',visible:true,disabled:true},{index:0,text:'',tag:'BUTTON',visible:false},{index:0,text:'',tag:'BUTTON',visible:true,label:'申请职位'},{index:0,text:'搜索',tag:'BUTTON',visible:true,type:'submit'},{index:0,text:'',tag:'B',visible:true,label:'合成岗位'},{index:0,text:'',tag:'B',visible:true,label:'立即申请'}]){
  const f=browserFixture(target);await f.port.connect();const observation=await f.port.navigate('https://example.com/jobs');const result=await f.port.act({kind:'click',selector:'button',snapshot_id:observation.data.snapshot_id});const allowed=target.type==='button'||target.label==='合成岗位';assert.equal(result.gate,allowed?'PASS':'REJECT');assert.equal(f.counts().clicks,allowed?1:0);
 }
});
test('explicit list reset reloads an unchanged URL only when requested',async()=>{
 const f=browserFixture({});await f.port.connect();await f.port.navigate('https://example.com/jobs');await f.port.navigate('https://example.com/jobs');await f.port.navigate('https://example.com/jobs',{reload:true});assert.equal(f.counts().reloads,1);
});

test('browser wait timeout rechecks login and rate-limit gates',async()=>{
 for(const [text,code] of [['请先登录','LOGIN_OR_CHALLENGE'],['访问过于频繁','RATE_LIMIT'],['页面加载中','BROWSER_ERROR']]){
  const f=browserFixture({},text);await f.port.connect();await f.port.navigate('https://example.com/jobs');assert.equal((await f.port.wait({selector:'article'})).code,code);
 }
});
