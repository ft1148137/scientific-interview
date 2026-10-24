import test from 'node:test';
import assert from 'node:assert/strict';
import {gate,pageGate} from '../slots/protocol.mjs';
import {runScan} from '../slots/runner.mjs';
import {createBrowserPort,manifest as browserManifest} from '../slots/browsers/codex-chrome/adapter.mjs';
import {completeMokaJD} from '../slots/sites/shared/moka.mjs';

// All observations in this file are synthetic; no network or personal data.
const ids=['moka-kimi-campus','moka-zhipu-campus','moka-step-campus','tencent-campus','jd-campus','didi-campus','kuaishou-campus','bytedance-campus','xiaohongshu-campus','meituan','amap','bytedance','moka-kimi','moka-zhipu','moka-step','xiaohongshu','kuaishou','didi'];
const modules=Object.fromEntries(await Promise.all(ids.map(async id=>[id,await import(`../slots/sites/${id}/adapter.mjs`)])));
function fixture(id, options={}) {
  const module=modules[id],m=module.manifest;
  const url=id==='tencent-campus'?'https://join.qq.com/post_detail.html?postid=123':id==='jd-campus'?'https://campus.jd.com/#/details?id=123':id==='kuaishou-campus'?'https://campus.kuaishou.cn/recruit/campus/e/#/campus/job-info/123':id==='bytedance-campus'?'https://jobs.bytedance.com/campus/position/123/detail':id==='xiaohongshu-campus'?'https://job.xiaohongshu.com/campus/position/123':id==='xiaohongshu'?'https://job.xiaohongshu.com/social/position/123':id==='kuaishou'?'https://zhaopin.kuaishou.cn/#/official/social/job-info/123':id==='didi'?'https://talent.didiglobal.com/social/jobDetail?jdId=123':id==='meituan'?'https://zhaopin.meituan.com/web/position/detail?jobUnionId=123':id==='amap'?'https://talent.amap.com/off-campus/position-detail?lang=zh&positionId=123':id==='bytedance'?'https://jobs.bytedance.com/experienced/position/123/detail':m.entry_url.replace('#/jobs','#/job/synthetic-123');
  const title='合成工程师',jd='岗位职责\n负责合成示例系统的设计、开发、测试和交付，维护质量并改进文档。\n任职要求\n理解软件工程，能够独立分析问题、验证方案并与团队协作。';
  let current=m.entry_url,page=1,sequence=0,searchSubmitted=false;
  const log=[];
  function observation(detail=false) {
    return gate('PASS','OBSERVED','',{data:{url:current,text:'合成账户页眉，请勿写入证据',observed_at:'2026-10-22T00:00:00Z',snapshot_id:++sequence,fields:detail?{title:options.title || title,jd:options.jd ?? jd,location:'合成城市',meta:'正式 · 合成届校园招聘'}:{},lists:detail?{info:options.info || [{label:'职位性质',value:'实习'},{label:'工作地点',value:'合成城市'}],sections:[{heading:id==='tencent-campus'?'岗位描述':'岗位职责',body:'合成职责',text:'岗位职责\n合成职责'},{heading:id==='tencent-campus'?'岗位要求':'任职要求',body:options.missing?'':'合成要求',text:options.missing?'任职要求':'任职要求\n合成要求'}],headings:[{text:'职位描述'},{text:'职位要求'}],blocks:[{text:'合成职责'},{text:options.missing?'':'合成要求'}]}:{jobs:[{index:0,text:(page===1?'合成卡片一':'合成卡片二')+(searchSubmitted?'搜索后':''),title,location:'合成城市',meta:'全职 | 合成城市',...(id==='didi-campus'||id.startsWith('moka')||['bytedance','xiaohongshu','bytedance-campus','xiaohongshu-campus'].includes(id)?{href:options.href || url}:{})}],pages:options.noPagination?[]:[{text:'1'},{text:'2'}]},clipped_fields:options.clipped?['jd']:[],controls:{}}});
  }
  const port={manifest:browserManifest,
    observe:async()=>observation(),
    navigate:async(target,opts)=>{log.push({op:'navigate',target,opts});current=options.redirect || target;if(opts?.reload){page=1;searchSubmitted=false;}return observation();},
    wait:async spec=>{log.push({op:'wait',spec});if(options.challenge)return gate('PASS','OK','',{data:{text:'请先登录',url:current}});const detail=!spec.observe?.lists?.jobs;const result=observation(detail);for(const selector of spec.observe?.controls || [])result.data.controls[selector]=options.noPagination?[]:[{index:0,visible:true,disabled:options.lastPage || page===2}];return result;},
    act:async action=>{log.push({op:'act',action});if(action.kind==='press')searchSubmitted=true;if(action.kind==='fill'||action.kind==='press'||action.selector.includes('input-search-button')||action.selector==='.search_text')return observation();if(action.selector.includes('Pagination')||action.selector.includes('pagination')||action.selector.includes('el-pager')){if(!options.stuck)page++;}else current=url;return observation();}
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

for(const id of ['bytedance-campus','xiaohongshu-campus'])test(`${id}: reject social paths, keep recruitment labels and handle incomplete evidence`,async()=>{
 const f=fixture(id);const social=f.url.replace('/campus/',id.startsWith('bytedance')?'/experienced/':'/social/');
 assert.equal((await f.site.readJob({url:social})).code,'SITE_SCOPE_REJECTED');assert.equal(f.log.length,0);
 assert.equal((await fixture(id,{href:social}).site.discover({})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await fixture(id,{redirect:social}).site.discover({})).code,'SITE_SCOPE_REJECTED');
 const read=await f.site.readJob({url:f.url,title:f.title});assert.match(read.data.jd,/正式 · 合成届校园招聘/);
 assert.equal((await fixture(id,{challenge:true}).site.discover({})).gate,'WAIT_USER');
 assert.equal((await fixture(id,{noPagination:true}).site.discover({})).data.coverage,'partial');
 assert.equal((await fixture(id,{title:'另一职位'}).site.readJob({url:f.url,title:f.title})).code,'IDENTITY_CHANGED');
});

for(const id of ['tencent-campus','jd-campus','didi-campus','kuaishou-campus'])test(`${id}: campus boundary, interrupted login and conservative coverage`,async()=>{
 const f=fixture(id);assert.equal((await f.site.readJob({url:'https://example.com/job/123'})).code,'SITE_SCOPE_REJECTED');assert.equal(f.log.length,0);
 assert.equal((await f.site.readJob({url:modules[id].manifest.entry_url})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await fixture(id,{challenge:true}).site.discover({})).gate,'WAIT_USER');
 assert.equal((await fixture(id,{noPagination:true}).site.discover({})).data.coverage,'partial');
 assert.equal((await fixture(id,{title:'另一岗位'}).site.readJob({url:f.url,title:f.title})).code,'IDENTITY_CHANGED');
 assert.equal((await f.site.discover({year:2027})).code,'UNSUPPORTED_QUERY');
 const page2=await f.site.discover({},{page:2});assert.equal(page2.gate,'PASS');assert.equal(page2.data.next_cursor,null);
 assert.equal((await fixture(id,{stuck:true}).site.discover({},{page:2})).code,'PAGE_NOT_CHANGED');
 if(id!=='didi-campus')assert.equal((await fixture(id,{missing:true}).site.readJob({url:f.url})).data.jd_complete,false);
});
test('JD campus submits keyword with Enter; non-link campus cards reject reordering',async()=>{
 const f=fixture('jd-campus');await f.site.discover({keyword:'算法'});
 assert.ok(f.log.some(x=>x.op==='act' && x.action.kind==='press' && x.action.key==='Enter'));
 for(const id of ['jd-campus','tencent-campus','kuaishou-campus']){
  const c=fixture(id);const ref=(await c.site.discover({})).data.refs[0];ref.card_text='已变化';
  assert.equal((await c.site.readJob(ref)).code,'LIST_CHANGED');
 }
});

for(const id of ['moka-kimi-campus','moka-zhipu-campus','moka-step-campus'])test(`${id}: preserve campus metadata and keep absent location unknown`,async()=>{
 const f=fixture(id);const r=await f.site.readJob({url:f.url,title:f.title});
 assert.match(r.data.jd,/职位性质：实习/);assert.equal(r.data.location,'合成城市');
 const missing=fixture(id,{info:[{label:'职能类型',value:'算法类'},{label:'工作地点',value:'-'}]});
 const found=await missing.site.discover({});assert.equal(found.data.refs[0].location,null);
 assert.equal((await missing.site.readJob(found.data.refs[0])).data.location,null);
 const clipped=fixture(id,{info:[{label:'工作地点',value:'不完整地点',clipped:true}]});
 const read=await clipped.site.readJob({url:clipped.url});assert.equal(read.data.location,null);assert.equal(read.data.jd_complete,false);
 const social=modules[id.replace('-campus','')].manifest.entry_url.replace('#/jobs','#/job/synthetic-123');
 assert.equal((await f.site.readJob({url:social})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await fixture(id,{href:social}).site.discover({})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await fixture(id,{redirect:social}).site.discover({})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await fixture(id,{challenge:true}).site.discover({})).gate,'WAIT_USER');
 assert.equal((await fixture(id,{noPagination:true}).site.discover({})).data.coverage,'partial');
 assert.equal((await fixture(id,{stuck:true}).site.discover({},{page:2})).code,'PAGE_NOT_CHANGED');
 assert.equal((await f.site.discover({year:2027})).code,'UNSUPPORTED_QUERY');
 const scan=await runScan(f.port,f.site,{},{maxJobs:1});
 const resumed=await runScan(f.port,f.site,{},{maxJobs:1,checkpoint:scan.checkpoint});
 assert.equal(resumed.records.length,0);
});
test('campus heading recognition keeps raw text and does not certify an unknown or empty section',async()=>{
 const body='合成测试正文，负责系统的开发、验证、部署和维护，能够与其他团队协作，并基于证据分析问题。';
 for(const [duty,req,complete] of [['核心职责','职位要求',true],['【岗位描述】','【任职资格】',true],['## 你会亲手打造','## 我们在找谁',true],['使命','核心要求',false],['岗位职责','任职要求',false]]){
  const jd=`${duty}\n${body}\n${req}\n${complete||duty==='使命'?body:''}`;
  const f=fixture('moka-kimi-campus',{jd});const read=await f.site.readJob({url:f.url});
  assert.equal(read.data.jd_complete,complete);assert.ok(read.data.jd.endsWith(jd));
 }
});
test('security duties do not impersonate a login challenge; actual prompts still stop collection',()=>{
 const check=text=>pageGate(gate('PASS','OBSERVED','',{data:{text}}));
 assert.equal(check('岗位职责\n参与工具调用链路的安全验证，跟进漏洞复现。').gate,'PASS');
 for(const text of ['安全验证','职位列表\n安全验证\n请点击图片','安全验证：请选择图片','请进行安全验证','请先登录','登录后查看','请完成验证','拖动滑块','sign in to continue'])assert.equal(check(text).gate,'WAIT_USER',text);
});
