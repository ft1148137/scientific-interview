import test from 'node:test';
import assert from 'node:assert/strict';
import {createSiteSlot} from '../slots/sites/linkedin/adapter.mjs';
import {gate} from '../slots/protocol.mjs';
import {readDOM} from '../slots/browsers/dom-observation.mjs';

const jd='Responsibilities\nDesign and maintain synthetic services, evaluate performance and document reliable engineering decisions.\nRequirements\nExperience in software engineering, testing and collaborating across teams with clear written communication.';
function fixture(options={}) {
 let page=1,url='https://www.linkedin.com/jobs/search-results/',region=options.region || 'United States',input='',expanded=false,detail=false,id='101',keyword='Engineer',seq=0;
 const actions=[];
 const observe=async(spec={})=>{
  const fields={};
  for(const key of Object.keys(spec.fields || {}))fields[key]=({region,keyword:options.wrongKeyword?'Other':keyword,page:String(page),input,editor:input,title:'Synthetic Engineer '+id,company:'Synthetic Company',location:'Synthetic City · Yesterday',jd,body_id:'JobDetails_AboutTheJob_'+(options.staleBody?'999':id)})[key];
  const lists={};
  for(const key of Object.keys(spec.lists || {}))lists[key]=key==='choices'?(options.choices || [{index:0,text:'Vereinigte Staaten von Amerika',href:'https://www.linkedin.com/jobs/search-results/?geoId=123'}]):[{index:0,text:'card '+page+' '+region,external_id:'job-card-component-ref-'+(100+page),title:'Synthetic Engineer '+(100+page),company:'Synthetic Company',location:'Synthetic City'}];
  const controls=Object.fromEntries((spec.controls || []).map(s=>[s,[{index:0,visible:options.absent?false:s.includes('expandable-text-button')?!expanded:true,disabled:false,text:'Synthetic control',tag:'BUTTON'}]]));
  return gate('PASS','OBSERVED','',{data:{url,text:'Private account navigation must not enter evidence',observed_at:'2026-10-26T00:00:00Z',snapshot_id:++seq,fields,lists,controls,clipped_fields:options.clipped?['jd']:[]}});
 };
 const port={
  navigate:async target=>{detail=target.includes('/jobs/view/');if(detail){id=target.match(/(\d+)$/)[1];url=target;expanded=false;}else{page=1;keyword=new URL(target).searchParams.get('keywords');url=options.login?'https://www.linkedin.com/login':'https://www.linkedin.com/jobs/search-results/';}return observe();},
  observe,wait:async spec=>options.waitError?gate('RETRY','BROWSER_ERROR','Detached element',{retryAfter:2}):observe(spec.observe),
  act:async action=>{actions.push(action);if(action.selector.includes('pagination-controls')&&!options.stuck)page++;if(action.selector.includes('clear-small'))input='';if(action.kind==='fill')input=action.value;if(action.selector.includes('LocationList')&&!options.notApplied){region='Vereinigte Staaten von Amerika';url+='?geoId=123';}if(action.selector.includes('expandable-text-button'))expanded=true;return observe();}
 };
 return {site:createSiteSlot(port),actions};
}
test('signed-in discovery resolves country through visible candidates and preserves stable IDs',async()=>{
 const f=fixture({region:'China'}),r=await f.site.discover({keyword:'Engineer',city:'美国'});
 assert.equal(r.gate,'PASS');assert.equal(r.data.refs[0].external_id,'101');
 assert.equal(r.data.refs[0].url,'https://www.linkedin.com/jobs/view/101');
 assert.equal(r.data.search_evidence.region,'Vereinigte Staaten von Amerika');
 assert.equal(r.data.coverage,'partial');assert.ok(f.actions.some(x=>x.kind==='fill'&&x.value==='United States'));
 assert.ok(f.actions.every(x=>!x.selector.includes('dismiss')&&!x.selector.includes('apply')));
});
test('ambiguous locations, missing global scope and unapplied selections stop instead of using account region',async()=>{
 assert.equal((await fixture().site.discover({keyword:'Engineer',city:'Worldwide'})).code,'REGION_REQUIRED');
 const choices=[{index:0,text:'London, Canada',href:'https://www.linkedin.com/jobs/search-results/?geoId=1'},{index:1,text:'London, UK',href:'https://www.linkedin.com/jobs/search-results/?geoId=2'}];
 assert.equal((await fixture({choices}).site.discover({keyword:'Engineer',city:'London'})).code,'REGION_NOT_RESOLVED');
 assert.equal((await fixture({region:'China',notApplied:true}).site.discover({keyword:'Engineer',city:'United States'})).code,'REGION_NOT_APPLIED');
});
test('signed-in pagination verifies page and changed cards; keyword mismatch cannot pass',async()=>{
 const r=await fixture().site.discover({keyword:'Engineer',city:'United States'},{page:2});
 assert.equal(r.gate,'PASS');assert.equal(r.data.refs[0].external_id,'102');
 assert.equal((await fixture({stuck:true}).site.discover({keyword:'Engineer',city:'United States'},{page:2})).code,'PAGE_NOT_CHANGED');
 assert.equal((await fixture({wrongKeyword:true}).site.discover({keyword:'Engineer',city:'United States'})).code,'KEYWORD_NOT_APPLIED');
});
test('details expand the JD, check body identity and exclude account navigation',async()=>{
 const f=fixture(),ref=(await f.site.discover({keyword:'Engineer',city:'United States'})).data.refs[0];
 const r=await f.site.readJob(ref);assert.equal(r.gate,'PASS');assert.equal(r.data.jd_complete,true);
 assert.ok(!r.data.evidence.text.includes('Private account'));
 assert.ok(f.actions.some(x=>x.selector.includes('expandable-text-button')));
 assert.equal((await fixture({staleBody:true}).site.readJob(ref)).code,'IDENTITY_CHANGED');
 assert.equal((await fixture({clipped:true}).site.readJob(ref)).data.jd_complete,false);
 assert.equal((await f.site.readJob({...ref,url:'https://other.example/jobs/view/101'})).code,'SITE_SCOPE_REJECTED');
});
test('expired authentication is a login handoff rather than a missing-layout failure',async()=>{
 assert.equal((await fixture({login:true}).site.discover({city:'United States'})).gate,'WAIT_USER');
});
test('DOM fields support card identity and indexed visible paragraphs',()=>{
 const oldDoc=globalThis.document,oldStyle=globalThis.getComputedStyle;
 const paragraph=text=>({innerText:text,parentElement:null,getBoundingClientRect:()=>({width:5,height:5}),querySelectorAll:()=>[]});
 const ps=[paragraph('Title'),paragraph('Company'),paragraph('City')];
 const card={...paragraph('Card'),getAttribute:k=>k==='componentkey'?'job-card-component-ref-101':null,querySelectorAll:s=>s==='p'?ps:[]};
 globalThis.document={body:{innerText:'Synthetic'},querySelectorAll:()=>[card]};globalThis.getComputedStyle=()=>({webkitLineClamp:'none'});
 try{const r=readDOM({fields:{},controls:[],lists:{jobs:{selector:'.card',fields:{id:{selector:':scope',attribute:'componentkey'},company:{selector:'p',index:1},location:{selector:'p',index:2}}}}});assert.equal(r.lists.jobs[0].id,'job-card-component-ref-101');assert.equal(r.lists.jobs[0].company,'Company');assert.equal(r.lists.jobs[0].location,'City');}finally{globalThis.document=oldDoc;globalThis.getComputedStyle=oldStyle;}
});

test('detached-element waits pass only when a fresh observation finds the replacement',async()=>{
 assert.equal((await fixture({waitError:true}).site.discover({keyword:'Engineer',city:'United States'})).gate,'PASS');
 assert.equal((await fixture({waitError:true,absent:true}).site.discover({keyword:'Engineer',city:'United States'})).code,'BROWSER_ERROR');
 assert.equal((await fixture({waitError:true,stuck:true}).site.discover({keyword:'Engineer',city:'United States'},{page:2})).code,'PAGE_NOT_CHANGED');
});
