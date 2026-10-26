import test from 'node:test';
import {loadI18n} from './i18n-helper.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Exercise the actual dashboard handlers while holding HTTP replies pending.
const template=readFileSync(new URL('../templates/dashboard.html',import.meta.url),'utf8');
const handlers=template.slice(template.indexOf('function tagButtons('),template.indexOf('if(!shared&&!writable)'));
function fixture({writable=true,applied=[]}={}){
  const data={revision:10,jobs:Object.fromEntries(['a','b','c'].map(key=>[key,{current:{key,title:'合成岗位 '+key},decision:'undecided',decision_history:[]}]))};
  const nodes=Object.fromEntries(['tag-message','detail-tag-message','detail','job-list','decision'].map(id=>[id,{dataset:{},open:false,textContent:'',querySelectorAll:()=>[],focus(){}}]));
  const requests=[],views=[],details=[],events={};
  const context=vm.createContext({data,writable,shared:false,appliedKeys:new Set(applied),decision:{shortlist:'投递候选',excluded:'不感兴趣',undecided:'未决定'},esc:String,
    $:id=>nodes[id],document:{activeElement:null},window:{addEventListener:(name,fn)=>events[name]=fn},
    renderJobs:()=>views.push(Object.values(data.jobs).filter(j=>j.decision==='undecided').map(j=>j.current.key)),showDetail:key=>details.push(key),
    fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,body:options?JSON.parse(options.body):null,resolve,reject}))});
  loadI18n(context);
  vm.runInContext('let tagBusy=false,tagBlocked=false,sessionToken="synthetic-token";const tagQueue=[],pendingTags=new Map();'+handlers,context);
  const call=(key,value)=>context.saveTag(key,value);
  const respond=(i,status,body)=>requests[i].resolve({ok:status===200,json:async()=>body});
  return {context,data,nodes,requests,views,details,events,call,respond};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('labels and filtered rows update before HTTP completes; queued writes use the confirmed revision',async()=>{
  const f=fixture();const done=f.call('a','shortlist');f.call('b','excluded');
  assert.deepEqual(f.views.at(-1),['c']);assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.revision,10);
  assert.equal(f.data.jobs.a.decision_history.length,0); // Do not invent persisted history.
  f.call('a','excluded');assert.equal(f.data.jobs.a.decision,'shortlist');
  let prevented=false;f.events.beforeunload({preventDefault(){prevented=true;}});assert.ok(prevented);
  f.respond(0,200,{decision:'shortlist',history:[{decision:'shortlist'}],revision:11});await tick();
  assert.equal(f.requests.length,2);assert.equal(f.requests[1].body.revision,11);
  f.respond(1,200,{decision:'excluded',history:[{decision:'excluded'}],revision:12});await done;
  assert.equal(f.data.revision,12);assert.equal(f.data.jobs.b.decision,'excluded');
  prevented=false;f.events.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,false);
});
test('a conflict rolls back unconfirmed choices, cancels the queue and preserves prior successes',async()=>{
  const f=fixture();const done=f.call('a','shortlist');f.call('b','excluded');f.call('c','shortlist');
  f.respond(0,200,{decision:'shortlist',history:[],revision:11});await tick();
  f.respond(1,409,{error:'页面已过期'});await done;
  assert.equal(f.requests.length,2);assert.equal(f.data.jobs.a.decision,'shortlist');
  assert.equal(f.data.jobs.b.decision,'undecided');assert.equal(f.data.jobs.c.decision,'undecided');
  assert.match(f.nodes['tag-message'].textContent,/刷新核对/);
  f.call('b','shortlist');assert.equal(f.requests.length,2);
});
test('connection loss rolls back locally and asks to verify an ambiguous save',async()=>{
  const f=fixture();const done=f.call('a','shortlist');f.requests[0].reject(new Error('connection lost'));await done;
  assert.equal(f.data.jobs.a.decision,'undecided');assert.match(f.nodes['tag-message'].textContent,/刷新核对/);
});
test('cancel, read-only and applied-job guards remain intact; responses keep the current detail',async()=>{
  for(const options of [{writable:false},{applied:['a']}]){const f=fixture(options);f.call('a','shortlist');assert.equal(f.requests.length,0);assert.equal(f.data.jobs.a.decision,'undecided');}
  const f=fixture();f.data.jobs.a.decision='shortlist';const done=f.call('a','shortlist');
  assert.equal(f.data.jobs.a.decision,'undecided');assert.equal(f.requests[0].body.decision,'undecided');
  f.nodes.detail.open=true;f.nodes.detail.dataset.detailKey='b';
  f.respond(0,200,{decision:'undecided',history:[],revision:11});await done;
  assert.deepEqual(f.details,['b']);
});
test('a pending save does not reopen a detail closed by the user',async()=>{
  const f=fixture();f.nodes.detail.open=true;f.nodes.detail.dataset.detailKey='a';
  const done=f.call('a','shortlist');assert.deepEqual(f.details,['a']);
  f.nodes.detail.open=false;
  f.respond(0,200,{decision:'shortlist',history:[],revision:11});await done;
  assert.deepEqual(f.details,['a']);assert.equal(f.nodes.detail.open,false);
});
test('close clicks bubbling through a job container do not reopen details; job buttons still open',()=>{
  function element(tagName,dataset={},parent=null){return {tagName,dataset,parent,closest(selector){
    const [,tag,attr]=selector.match(/^(\w+)?\[data-([\w-]+)\]$/);
    const key=attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    for(let node=this;node;node=node.parent)if((!tag||node.tagName===tag)&&key in node.dataset)return node;
    return null;
  }};}
  const dialog=element('dialog',{jobKey:'a'}),close=element('button',{},dialog),events={},opened=[];
  dialog.open=true;dialog.close=()=>dialog.open=false;dialog.querySelector=()=>close;
  const context=vm.createContext({$:()=>dialog,document:{addEventListener:(name,fn)=>events[name]=fn},showDetail:key=>{opened.push(key);dialog.open=true;}});
  vm.runInContext(template.match(/\$\('detail'\)\.querySelector\('\.close'\)\.onclick=[^\n]+/)[0],context);
  vm.runInContext(template.slice(template.indexOf("document.addEventListener('click',e=>{"),template.indexOf('function csvCell(')),context);
  close.onclick();events.click({target:close});assert.equal(dialog.open,false);assert.deepEqual(opened,[]);
  events.click({target:element('span',{},element('button',{jobKey:'b'}))});
  assert.equal(dialog.open,true);assert.deepEqual(opened,['b']);
});
test('changing language while a save is pending preserves the queued decision and localizes its result',async()=>{
  const f=fixture();const done=f.call('a','shortlist');
  vm.runInContext("language='en'",f.context);
  f.respond(0,200,{decision:'shortlist',history:[{decision:'shortlist'}],revision:11});await done;
  assert.equal(f.data.jobs.a.decision,'shortlist');assert.equal(f.data.revision,11);
  assert.match(f.nodes['tag-message'].textContent,/Saved as/);
  assert.match(f.nodes['tag-message'].textContent,/合成岗位 a/);
});
