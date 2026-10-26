import test from 'node:test';
import assert from 'node:assert/strict';
import {gate,pageGate} from '../slots/protocol.mjs';
import {createInternationalSite,completeEnglishJD} from '../slots/sites/shared/international.mjs';
import {createSiteSlot as linkedin} from '../slots/sites/linkedin/adapter.mjs';
import {createSiteSlot as indeed} from '../slots/sites/indeed/adapter.mjs';
import {createSiteSlot as netflix} from '../slots/sites/netflix/adapter.mjs';
import {createSiteSlot as ashby} from '../slots/sites/openai/adapter.mjs';
import {createSiteSlot as greenhouse} from '../slots/sites/anthropic/adapter.mjs';
import {readDOM} from '../slots/browsers/dom-observation.mjs';

const jd='Responsibilities\nDesign and maintain synthetic demonstration services, document decisions, review code and verify reliability.\nRequirements\nExperience building software and collaborating on an engineering team with clear written communication.';
const manifest={id:'synthetic',kind:'site',version:'1',protocol_version:1,requires:[],domains:['jobs.example.com'],entry_url:'https://jobs.example.com/jobs',search_fields:['keyword'],keyword_mode:'visible-title',company:'Synthetic Company'};
function fixture({cards,detail={},stuck=false,config={},redirect}={}) {
 let url=manifest.entry_url, page=1;
 const log=[];
 const observe=(spec={})=>gate('PASS','OBSERVED','',{data:{url,text:'Synthetic account navigation — exclude from evidence',observed_at:'2026-10-26T00:00:00Z',snapshot_id:1,clipped_fields:detail.clipped?['jd']:[],fields:spec.lists?.jobs?{}:{title:'AI Engineer',jd,...detail},lists:spec.lists?.jobs?{jobs:cards || [{index:0,title:'AI Engineer',href:'https://jobs.example.com/jobs/1',text:'card '+page},{index:1,title:'AI Engineer',href:'https://jobs.example.com/jobs/1',text:'duplicate'},{index:2,title:'Sales Manager',href:'https://jobs.example.com/jobs/2',text:'sales'}]}:{},controls:Object.fromEntries((spec.controls || []).map(s=>[s,[{visible:true,disabled:false}]]))}});
 const port={navigate:async(target,opts)=>{log.push({op:'navigate',target,opts});url=redirect || target;if(opts?.reload)page=1;return observe();},wait:async spec=>{log.push({op:'wait',spec});return observe(spec.observe);},act:async action=>{log.push({op:'act',action});if(!stuck)page++;return observe();}};
 const site=createInternationalSite(port,{manifest,searchURL:()=>manifest.entry_url,listSpec:{lists:{jobs:{selector:'.card'}},controls:['.next']},next:'.next',detailSpec:{fields:{jd:'.jd'}},detailReady:'.jd',id:u=>u.pathname.match(/^\/jobs\/(\d+)$/)?.[1],...config});
 return {site,port,log};
}
test('visible-title search filters all tokens, deduplicates stable IDs and stays partial',async()=>{
 const f=fixture();const r=await f.site.discover({keyword:'ai engineer'});
 assert.deepEqual(r.data.refs.map(x=>x.external_id),['1']);assert.equal(r.data.coverage,'partial');
 assert.equal((await f.site.discover({keyword:'unmatched'})).data.refs.length,0);
 assert.equal((await f.site.discover({location:'London'})).code,'UNSUPPORTED_QUERY');
 assert.equal((await f.site.discover({keyword:42})).code,'UNSUPPORTED_QUERY');
});
test('native keyword is encoded and never replaced with a local title filter',async()=>{
 const f=fixture({config:{manifest:{...manifest,keyword_mode:'native'},searchURL:q=>manifest.entry_url+'?q='+encodeURIComponent(q.keyword)}});
 const r=await f.site.discover({keyword:'C++ / ML'});
 assert.equal(f.log[0].target,'https://jobs.example.com/jobs?q=C%2B%2B%20%2F%20ML');assert.equal(r.data.refs.length,2);
});
test('details retain evidence boundaries and reject title changes and clipped completeness',async()=>{
 const f=fixture();const ref=(await f.site.discover({})).data.refs[0];const r=await f.site.readJob(ref);
 assert.equal(r.data.jd_complete,true);assert.ok(!r.data.evidence.text.includes('account navigation'));
 assert.equal((await fixture({detail:{title:'Other'}}).site.readJob(ref)).code,'IDENTITY_CHANGED');
 assert.equal((await fixture({detail:{clipped:true}}).site.readJob(ref)).data.jd_complete,false);
});
test('English completeness requires both populated sections, not keyword mentions',()=>{
 for(const headings of [['What You’ll Do','What We’re Looking For'],['Every day','What sets you apart'],['Representative Projects','You may be a good fit if you'],['The Difference You Will Make','Your Expertise']])assert.equal(completeEnglishJD(jd.replace('Responsibilities',headings[0]).replace('Requirements',headings[1])),true);
 assert.equal(completeEnglishJD(jd.split('Requirements')[0]+'Requirements\n'),false);
 assert.equal(completeEnglishJD(jd.replaceAll('\n',' ')),false);
});
test('pagination detects stale lists instead of certifying another page',async()=>{
 assert.equal((await fixture({stuck:true}).site.discover({},{page:2})).code,'PAGE_NOT_CHANGED');
 assert.equal((await fixture().site.discover({},{page:2})).data.coverage,'partial');
});
test('shared ATS hosts still enforce the individual tenant before navigating',async()=>{
 let calls=0;const port={navigate:async()=>{calls++;throw Error('should not navigate');}};
 assert.equal((await ashby(port).readJob({url:'https://jobs.ashbyhq.com/other/00000000-0000-0000-0000-000000000000'})).code,'SITE_SCOPE_REJECTED');
 assert.equal((await greenhouse(port).readJob({url:'https://job-boards.greenhouse.io/other/jobs/123'})).code,'SITE_SCOPE_REJECTED');assert.equal(calls,0);
});
test('Indeed uses visible stable IDs for sponsored and organic cards, rejects missing IDs',async()=>{
 for(const prefix of ['sj','job']){
  const f=fixture({cards:[{title:'Synthetic Engineer',index:0,text:'Synthetic',href:'https://www.indeed.com/pagead/clk?tracking=opaque',external_id:prefix+'_0123456789abcdef'}]});
  const r=await indeed(f.port).discover({keyword:'Engineer'});
  assert.equal(r.gate,'PASS');assert.equal(r.data.refs[0].url,'https://www.indeed.com/viewjob?jk=0123456789abcdef');assert.equal(r.data.refs[0].external_id,'0123456789abcdef');
 }
 const bad=fixture({cards:[{title:'Synthetic',external_id:'invalid',href:'https://other.example/job'}]});assert.equal((await indeed(bad.port).discover({})).code,'DETAIL_ID_MISSING');
});
test('inline Netflix detail reloads the observed ID before reading a potentially stale JD',async()=>{
 let url='https://explore.jobs.netflix.net/careers',refreshed=false;
 const observation=(list=false)=>gate('PASS','OK','',{data:{url,text:'Synthetic',snapshot_id:1,observed_at:'2026-10-26T00:00:00Z',fields:{title:'AI Engineer',jd:refreshed?jd:'OLD BODY'},lists:list?{jobs:[{title:'AI Engineer',text:'Synthetic card',index:0}]}:{},controls:{}}});
 const port={navigate:async(target,opts)=>{url=target;if(opts?.reload && new URL(url).searchParams.has('pid'))refreshed=true;return observation();},wait:async spec=>observation(!!spec.observe?.lists?.jobs),act:async()=>{url='https://explore.jobs.netflix.net/careers?pid=123';return observation();}};
 const site=netflix(port),r=await site.readJob((await site.discover({keyword:'Engineer'})).data.refs[0]);
 assert.equal(r.gate,'PASS');assert.equal(refreshed,true);assert.equal(r.data.external_id,'123');assert.equal(r.data.jd,jd);
});
test('resolved DOM href honors document base for both nested links and anchor cards',()=>{
 const oldDoc=globalThis.document,oldStyle=globalThis.getComputedStyle;
 const a={innerText:'AI Engineer',href:'https://jobs.example.com/base/jobs/1',getBoundingClientRect:()=>({width:10,height:10}),getAttribute:k=>k==='href'?'jobs/1':null,querySelectorAll:()=>[],parentElement:null};
 const card={...a,href:null,getAttribute:()=>null,querySelectorAll:()=>[a]};
 globalThis.document={body:{innerText:'Synthetic'},querySelectorAll:s=>s==='.card'?[card]:[a]};globalThis.getComputedStyle=()=>({webkitLineClamp:'none'});
 try {const r=readDOM({fields:{url:{selector:'a',attribute:'href'}},lists:{jobs:{selector:'.card',fields:{href:{selector:'a',attribute:'href'}}},anchors:{selector:'a'}},controls:[]});assert.equal(r.fields.url,a.href);assert.equal(r.lists.jobs[0].href,a.href);assert.equal(r.lists.anchors[0].href,a.href);} finally {globalThis.document=oldDoc;globalThis.getComputedStyle=oldStyle;}
});
test('English blocking prompts wait while ordinary sign-in navigation remains readable',()=>{
 for(const text of ['Verify you are human','Checking your browser','Sign in to view job details','Complete the CAPTCHA'])assert.equal(pageGate(gate('PASS','OK','',{data:{text}})).gate,'WAIT_USER');
 assert.equal(pageGate(gate('PASS','OK','',{data:{text:'Sign in\nAI Engineer\n'+jd}})).gate,'PASS');
});

test('LinkedIn passes saved keyword and region without injecting filters and rejects non-text regions',async()=>{
 const cards=[{title:'Synthetic Engineer',href:'https://www.linkedin.com/jobs/view/123',text:'Synthetic',index:0}];
 for (const city of [undefined, '', 'United Kingdom', 'Hong Kong & Kowloon']) {
  const f=fixture({cards});
  const result=await linkedin(f.port).discover({keyword:'C++ Engineer',...(city===undefined?{}:{city})});
  assert.equal(result.gate,'PASS');
  const query=new URL(f.log[0].target).searchParams;
  assert.equal(query.get('keywords'),'C++ Engineer');
  assert.equal(query.get('location'),city || 'Worldwide');
  assert.deepEqual([...query.keys()],['keywords','location']);
 }
 for (const city of [42,null,[],{}]) {
  const f=fixture({cards});
  assert.equal((await linkedin(f.port).discover({city})).code,'UNSUPPORTED_QUERY');
  assert.equal(f.log.length,0);
 }
});
