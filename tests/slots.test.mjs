import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {negotiate,pageGate,assertURL,gate} from '../slots/protocol.mjs';
import {runScan} from '../slots/runner.mjs';
import {manifest as siteManifest} from '../slots/sites/tencent/adapter.mjs';
import {manifest as browserManifest,createBrowserPort} from '../slots/browsers/codex-chrome/adapter.mjs';
test('domains and required capabilities',()=>{assert.throws(()=>assertURL('https://careers.tencent.com.evil.test/',siteManifest.domains));assert.equal(negotiate(siteManifest,{...browserManifest,capabilities:[]}).gate,'REJECT');assert.equal(negotiate(siteManifest,browserManifest).gate,'PASS');});
test('header login is not blocking',()=>{assert.equal(pageGate(gate('PASS','OK','',{data:{text:'登录\n岗位职责'}})).gate,'PASS');assert.equal(pageGate(gate('PASS','OK','',{data:{text:'请先登录'}})).gate,'WAIT_USER');});
test('missing extension waits instead of falling back',async()=>{const p=createBrowserPort({listBrowsers:async()=>[]},siteManifest.domains);assert.equal((await p.connect()).gate,'WAIT_USER');});
test('checkpoint and resume preserve completed jobs',async()=>{
 const port={manifest:browserManifest};let blocked=true;
 const site={manifest:siteManifest,discover:async()=>gate('PASS','OK','',{data:{refs:[{url:'https://careers.tencent.com/a'},{url:'https://careers.tencent.com/b'}],next_cursor:null}}),readJob:async ref=>ref.url.endsWith('/b')&&blocked?gate('WAIT_USER','LOGIN'):gate('PASS','OK','',{data:{url:ref.url}})};
 const first=await runScan(port,site,{},{});assert.equal(first.records.length,1);assert.equal(first.gate,'WAIT_USER');
 blocked=false;const second=await runScan(port,site,{}, {checkpoint:first.checkpoint});assert.equal(second.records.length,1);assert.equal(second.coverage,'complete');
 assert.equal((await runScan(port,site,{keyword:'different'},{checkpoint:first.checkpoint})).gate,'REJECT');
});
test('resume rediscovers reordered list',async()=>{
 const port={manifest:browserManifest};let refs=[{url:'https://careers.tencent.com/a'},{url:'https://careers.tencent.com/b'}];
 const site={manifest:siteManifest,discover:async()=>gate('PASS','OK','',{data:{refs,next_cursor:null}}),readJob:async ref=>gate('PASS','OK','',{data:ref})};
 const one=await runScan(port,site,{}, {maxJobs:1});refs.reverse();const two=await runScan(port,site,{}, {checkpoint:one.checkpoint});assert.equal(two.records[0].url,'https://careers.tencent.com/b');
});
test('one unsupported job does not stop other jobs',async()=>{
 const site={manifest:siteManifest,discover:async()=>gate('PASS','OK','',{data:{refs:[{url:'unsupported'},{url:'valid'}],next_cursor:null}}),readJob:async ref=>ref.url==='unsupported'?gate('REJECT','DOMAIN_REJECTED'):gate('PASS','OK','',{data:ref})};
 const out=await runScan({manifest:browserManifest},site,{},{});assert.equal(out.records.length,1);assert.equal(out.rejected_refs.length,1);assert.equal(out.coverage,'partial');
});
test('JS and JSON manifests agree',async()=>{
 const fs=await import('node:fs/promises');
 const registry=JSON.parse(await fs.readFile(new URL('../slots/registry.json',import.meta.url),'utf8'));
 for(const entry of registry.slots){
  const path=entry.replace(/^slots\//,'').replace(/\/manifest.json$/,'');
  if(path==='sites/manual')continue;
  const json=JSON.parse(await fs.readFile(new URL('../slots/'+path+'/manifest.json',import.meta.url),'utf8'));
  const module=await import('../slots/'+path+'/adapter.mjs');
  for(const [key,value] of Object.entries(module.manifest))assert.deepEqual(json[key],value,`${path}.${key}`);
 }
});
test('Tencent pagination waits for replacement content',async()=>{
 const {createSiteSlot}=await import('../slots/sites/tencent/adapter.mjs');let waits=[];
 const observed={text:'岗位',url:'https://careers.tencent.com/search.html',snapshot_id:1,lists:{jobs:[{title:'old',text:'old job',index:0}],pages:[{text:'1'},{text:'2'}]}};
 const port={navigate:async()=>gate('PASS','OK','',{data:observed}),wait:async spec=>{waits.push(spec);return gate('PASS','OK','',{data:observed})},act:async()=>gate('PASS','OK','',{data:observed})};
 await createSiteSlot(port).discover({keyword:'Agent'},{page:2});assert.equal(waits[1].previousText,'old job');
});
test('rate limit preserves wait, enforces delay and caps resumed retries',async t=>{
 let clock=Date.parse('2026-10-22T00:00:00Z'),calls=0,blocked=true;
 t.mock.method(Date,'now',()=>clock);
 const site={manifest:siteManifest,discover:async()=>{calls++;return gate('PASS','OK','',{data:{refs:[{url:'a'},{url:'b'}],next_cursor:null}})},readJob:async ref=>ref.url==='b'&&blocked?gate('RETRY','RATE_LIMIT','等待',{retryAfter:30}):gate('PASS','OK','',{data:ref})};
 const port={manifest:browserManifest};
 const first=await runScan(port,site,{});assert.equal(first.code,'RATE_LIMIT');assert.equal(first.retryAfter,30);assert.deepEqual(first.seen_urls,['a']);
 const early=await runScan(port,site,{}, {checkpoint:first.checkpoint});assert.equal(early.code,'RETRY_NOT_READY');assert.equal(calls,1);assert.equal(early.retry_attempts,0);
 clock+=30000;const second=await runScan(port,site,{}, {checkpoint:first.checkpoint});assert.equal(second.retry_attempts,1);
 clock+=30000;const third=await runScan(port,site,{}, {checkpoint:second.checkpoint});assert.equal(third.retry_attempts,2);
 clock+=30000;const stop=await runScan(port,site,{}, {checkpoint:third.checkpoint});assert.equal(stop.code,'RETRY_EXHAUSTED');assert.equal(stop.gate,'WAIT_USER');assert.equal(calls,3);
 blocked=false;const recovered=await runScan(port,site,{}, {checkpoint:stop.checkpoint,resumeAfterUser:true});assert.equal(recovered.coverage,'complete');assert.deepEqual(recovered.records,[{url:'b'}]);
});
test('Python doctor and JavaScript negotiate share one response contract',()=>{
 const script="import json; from job_workbench.contracts import negotiate; from job_workbench.registry import registry; r=registry(); b=r['codex-chrome']; print(json.dumps([negotiate(r['tencent'],b),negotiate(r['tencent'],dict(b,capabilities=[]))],ensure_ascii=False))";
 const r=spawnSync(process.env.PYTHON||'python3',['-c',script],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[negotiate(siteManifest,browserManifest),negotiate(siteManifest,{...browserManifest,capabilities:[]})]);
});
test('browser-neutral example runs without host or network and ingests as fixture',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const example=spawnSync(process.execPath,['examples/slot-extension.mjs'],{cwd:root,encoding:'utf8'});assert.equal(example.status,0,example.stderr);
 const scan=JSON.parse(example.stdout);assert.equal(scan.coverage,'complete');assert.equal(scan.records.length,1);assert.equal(scan.browser_id,'fixture');
 const script="import sys,json; from job_workbench.store import empty_state; from job_workbench.jobs import ingest_scan; s=empty_state(); r=ingest_scan(s,json.load(sys.stdin)); assert not r['rejected']; assert len(s['jobs'])==1";
 const ingested=spawnSync(process.env.PYTHON||'python3',['-c',script],{cwd:root,encoding:'utf8',input:example.stdout});assert.equal(ingested.status,0,ingested.stderr);
});
