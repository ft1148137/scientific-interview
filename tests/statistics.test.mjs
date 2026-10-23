import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({Date,Map,Number});
vm.runInContext(readFileSync(new URL('../templates/statistics.js',import.meta.url),'utf8'),context);
const {statistics,inactiveJob}=context;
const at=new Date('2026-10-22T12:00:00Z');
const job=(company='甲公司',classification={})=>({current:{company},classification,last_changed_at:'2026-09-22T12:00:00Z'});
const event=(key,status,date)=>({key,status,evidence:{observed_at:date},at:'2026-10-22T12:00:00Z'});
test('one application per job, current state follows evidence time, not insertion order',()=>{
 const data={jobs:{a:job(),b:job(),c:job('乙公司')},applications:[event('a','rejected','2026-10-21T10:00:00Z'),event('a','submitted','2026-10-01T10:00:00Z'),event('a','submitted','2026-10-01T10:00:00Z'),event('b','submitted','2026-10-20T10:00:00Z'),event('c','unknown','2026-10-20T10:00:00Z')]};
 const s=statistics(data,at);assert.equal(s.total,2);assert.equal(s.companies.length,1);assert.equal(s.inProgress.length,1);assert.equal(s.rejected.length,1);assert.equal(s.unknownOnly,1);assert.equal(s.thisWeek.length,1);
});
test('feedback is a status change, deduped per job per week; withdrawal is excluded',()=>{
 const data={jobs:{a:job(),b:job()},applications:[event('a','submitted','2026-10-01T10:00:00Z'),event('a','in_review','2026-10-19T10:00:00Z'),event('a','interview','2026-10-20T10:00:00Z'),event('a','interview','2026-10-21T10:00:00Z'),event('b','withdrawn','2026-10-21T10:00:00Z')]};
 const s=statistics(data,at);assert.equal(s.weeks.at(-1).feedback.length,1);assert.equal(s.rows.find(r=>r.key==='a').feedback.length,2);assert.equal(s.missingSubmissionDate,1);assert.equal(s.weeks.reduce((n,w)=>n+w.submitted.length,0),1);
 data.applications.push(event('a','interview','2026-10-28T10:00:00Z'));
 assert.equal(statistics(data,new Date('2026-10-29T12:00:00Z')).weeks.at(-1).feedback.length,0);
});
test('classifications are explicit; cohort filter applies across distributions and trend',()=>{
 const data={jobs:{a:job('甲公司',{direction:'研发',industry:'软件'}),b:job('乙公司')},applications:[event('a','submitted','2026-08-01T10:00:00Z'),event('a','interview','2026-10-21T10:00:00Z'),event('b','submitted','2026-10-20T10:00:00Z')]};
 const s=statistics(data,at,30);assert.equal(s.total,1);assert.equal(s.directions[0].label,'未分类');assert.equal(s.industries[0].label,'未分类');assert.equal(s.companies[0].label,'乙公司');assert.equal(s.weeks.at(-1).feedback.length,0);
 assert.equal(statistics(data,at).directions.length,2);
});
test('unknown and future records do not create confirmed applications',()=>{
 const s=statistics({jobs:{a:job()},applications:[event('a','unknown','2026-10-01T10:00:00Z'),event('a','submitted','2026-12-01T10:00:00Z'),event('missing','submitted','2026-10-01T10:00:00Z')]},at);
 assert.equal(s.total,0);assert.equal(s.companies.length,0);assert.equal(s.weeks.length,12);assert.equal(s.weeks.reduce((n,w)=>n+w.feedback.length,0),0);
});
test('inactivity has an exact 30 day threshold and is separate from hiring status',()=>{
 const j=job();assert.equal(inactiveJob(j,at),true);assert.equal(inactiveJob(j,new Date(+at-1)),false);
 j.current.status='open';assert.equal(inactiveJob(j,at),true);
 j.last_changed_at='2026-10-01T12:00:00Z';assert.equal(inactiveJob(j,at),false);
 j.last_changed_at=null;assert.equal(inactiveJob(j,at),false);
 j.last_changed_at='2026-12-01T12:00:00Z';assert.equal(inactiveJob(j,at),false);
});
test('line chart renders both series and accessible weekly values including all-zero data',()=>{
 const chartContext=vm.createContext({Date,Map,Number,esc:s=>String(s).replaceAll('<','&lt;')});
 vm.runInContext(readFileSync(new URL('../templates/statistics-view.js',import.meta.url),'utf8'),chartContext);
 const empty=statistics({jobs:{},applications:[]},at);
 const html=chartContext.lineChart(empty.weeks);
 assert.equal((html.match(/<polyline /g)||[]).length,2);
 assert.equal((html.match(/<g role="button"/g)||[]).length,24);
 assert.ok(html.includes('stroke-dasharray="6 4"'));
 assert.ok(html.includes('查看每周数值与明细'));
 assert.ok(!html.includes('NaN')&&!html.includes('Infinity'));
 const data={jobs:{a:job()},applications:[event('a','submitted','2026-10-20T10:00:00Z')]};
 assert.ok(chartContext.lineChart(statistics(data,at).weeks).includes('投递 1 个岗位'));
});
test('ring segments expose labels on demand without a permanent legend, including single category',()=>{
 const chartContext=vm.createContext({esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
 vm.runInContext(readFileSync(new URL('../templates/statistics-view.js',import.meta.url),'utf8'),chartContext);
 const html=chartContext.ringChart([{label:'A < B',count:2,keys:['a','b']}],2,'申请');
 assert.ok(!html.includes('class="legend"'));
 assert.ok(html.includes('data-ring-label="A &lt; B · 2 份 · 100.0%"'));
 assert.ok(html.includes('role="tooltip" hidden'));
 assert.ok(html.includes('tabindex="0"'));
 assert.ok(html.includes('A 62 62 0 1 1'));
 assert.ok(!html.includes('NaN'));
 assert.ok(chartContext.ringChart([],0,'申请').includes('暂无已确认投递'));
});
test('application colors are stable semantic colors in every cohort',()=>{
 const states=['submitted','in_review','interview','offer','rejected','withdrawn'];
 const data={jobs:{},applications:[]};
 states.forEach((status,i)=>{data.jobs[i]=job();data.applications.push(event(String(i),status,'2026-10-20T10:00:00Z'));});
 for(const days of [0,30]){
  const colors=Object.fromEntries(statistics(data,at,days).statuses.map(g=>[g.status,g.color]));
  assert.equal(colors.submitted,'#e4b83e');assert.equal(colors.in_review,colors.submitted);assert.equal(colors.interview,colors.submitted);
  assert.equal(colors.rejected,'#d34c4c');assert.equal(colors.offer,'#32915b');assert.equal(colors.withdrawn,'#969b96');
 }
});
