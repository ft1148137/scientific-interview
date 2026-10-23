import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from job_workbench.store import Store, WorkbenchError, read_json
from job_workbench.registry import ROOT, registry
from job_workbench.contracts import negotiate, jd_hash
from job_workbench.jobs import ingest_scan, decide, review_job, record_application, classify_job
from job_workbench.library import put_entry, restore_entry, find_answer, interview
from job_workbench.resumes import draft_resume, save_resume, export_resume, import_resume, resume_diff, source_updates
from job_workbench.render import render_dashboard

class WorkbenchTests(unittest.TestCase):
 def setUp(self):
  (ROOT/"data/tmp").mkdir(parents=True,exist_ok=True)
  self.temp=tempfile.TemporaryDirectory(dir=ROOT/"data/tmp");self.addCleanup(self.temp.cleanup)
  self.store=Store(self.temp.name);self.store.init()
  self.first=read_json(ROOT/'examples/scan-first.json');self.second=read_json(ROOT/'examples/scan-second.json')
 def library(self):
  def fn(s):
   put_entry(s,'profiles','personal',read_json(ROOT/'examples/profile.json'),True)
   put_entry(s,'experiences','knowledge-assistant',read_json(ROOT/'examples/experience.json'),True)
  self.store.update(fn)
 def test_scan_preserves_decisions_and_applications(self):
  self.store.update(lambda s:ingest_scan(s,self.first))
  self.store.update(lambda s:decide(s,'demo-company:id:101','excluded','用户决定'))
  ev={'url':'https://jobs.example.com/jobs/101','observed_at':'2026-10-21T10:00:00+08:00','text':'申请成功','kind':'application'}
  self.store.update(lambda s:record_application(s,'demo-company:id:101','submitted',ev))
  result=self.store.update(lambda s:ingest_scan(s,self.second));s=self.store.read()
  self.assertEqual(s['jobs']['demo-company:id:101']['decision'],'excluded');self.assertEqual(len(s['applications']),1)
  self.assertEqual({x['type'] for x in result['changes']},{'new','jd_changed','closed'})
  self.assertTrue(self.store.update(lambda s:ingest_scan(s,self.second))['idempotent'])
 def test_same_content_has_no_changes(self):
  self.store.update(lambda s:ingest_scan(s,self.first));scan=copy.deepcopy(self.first);scan['id']='same-content'
  self.assertEqual(self.store.update(lambda s:ingest_scan(s,scan))['changes'],[])
 def test_failure_or_missing_never_means_closed(self):
  self.store.update(lambda s:ingest_scan(s,self.first));scan=copy.deepcopy(self.first);scan.update(id='empty',records=[],gate='RETRY',coverage='unknown')
  self.store.update(lambda s:ingest_scan(s,scan));self.assertEqual(self.store.read()['jobs']['demo-company:id:101']['current']['status'],'open')
  scan.update(id='missing',gate='PASS',coverage='complete');self.store.update(lambda s:ingest_scan(s,scan))
  self.assertEqual(self.store.read()['jobs']['demo-company:id:101']['verification'],'needs_recheck')
 def test_closed_needs_evidence(self):
  scan=copy.deepcopy(self.first);scan['records'][0]['status']='closed'
  r=self.store.update(lambda s:ingest_scan(s,scan));self.assertEqual(len(r['rejected']),1)
 def test_quarantine_does_not_drop_good_jobs(self):
  scan=copy.deepcopy(self.first);scan['records'][0]['url']='javascript:alert(1)'
  r=self.store.update(lambda s:ingest_scan(s,scan));self.assertEqual(len(r['rejected']),1);self.assertEqual(len(self.store.read()['jobs']),2)
 def test_old_observation_rejected(self):
  self.store.update(lambda s:ingest_scan(s,self.first));scan=copy.deepcopy(self.first);scan['id']='older'
  scan['records'][0]['observed_at']='2026-10-21T07:00:00+09:00';scan['records'][0]['title']='旧标题'
  self.assertEqual(len(self.store.update(lambda s:ingest_scan(s,scan))['rejected']),1)
 def test_revision_conflict_lock_and_rollback(self):
  old=self.store.read()['revision'];self.store.update(lambda s:s.update(note='new'))
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:s.update(note='old'),old)
  def fail(s):s['note']='bad';raise WorkbenchError('abort')
  with self.assertRaises(WorkbenchError):self.store.update(fail)
  self.assertEqual(self.store.read()['note'],'new');self.assertTrue((self.store.root/'backups/00000000.json').exists())
  with self.store.lock():
   with self.assertRaises(WorkbenchError):self.store.update(lambda s:None)
 def test_library_conflict_and_restore(self):
  self.library();entry=self.store.read()['experiences']['knowledge-assistant'][-1]['data'];entry['result']='修改后的真实结果'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:put_entry(s,'experiences','knowledge-assistant',entry,True))
  self.store.update(lambda s:put_entry(s,'experiences','knowledge-assistant',entry,True,1))
  self.store.update(lambda s:restore_entry(s,'experiences','knowledge-assistant',1))
  h=self.store.read()['experiences']['knowledge-assistant'];self.assertEqual(len(h),3);self.assertEqual(h[-1]['data'],h[0]['data'])
 def test_answer_context_matters(self):
  self.store.update(lambda s:put_entry(s,'answers','why',read_json(ROOT/'examples/answer.json'),True));s=self.store.read()
  self.assertEqual(find_answer(s,'为什么申请 AI 应用工程师？','AI 应用工程师')[0]['reuse'],'confirmed')
  self.assertEqual(find_answer(s,'为什么申请 AI 应用工程师？','另一个岗位')[0]['reuse'],'draft_review_required')
 def test_interview_adapts_and_skips(self):
  q=self.store.update(lambda s:interview(s,'one','AI 应用'));self.assertLessEqual(len(q['questions']),3)
  self.store.update(lambda s:put_entry(s,'experiences','a',{'title':'个人项目','context':'问题已说明'},False))
  q=self.store.update(lambda s:interview(s,'one'));self.assertEqual(q['questions'][0]['id'],'a:responsibility')
  q=self.store.update(lambda s:interview(s,'one',skip=['a:responsibility']));self.assertNotIn('a:responsibility',[x['id'] for x in q['questions']])
 def test_resume_roundtrip_and_source_validation(self):
  self.library();draft=draft_resume(self.store.read(),'AI 应用');r=self.store.update(lambda s:save_resume(s,draft,True));bad=copy.deepcopy(draft);bad['entries'][0]['organization']='虚构单位'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:save_resume(s,bad,True))
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:save_resume(s,draft,False))
  result=export_resume(self.store,r['id']);self.assertTrue((Path(result['directory'])/'resume.pdf').exists())
  imported=import_resume(self.store,Path(result['directory'])/'resume.docx');self.assertIn('知识检索助手',imported['text']);self.assertEqual(imported['status'],'needs_review')
 def test_missing_jd_cannot_score(self):
  self.store.update(lambda s:ingest_scan(s,self.first))
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:review_job(s,'demo-company:id:103',{'score':5}))
 def test_review_validates_quotes(self):
  self.library();self.store.update(lambda s:ingest_scan(s,self.first));key='demo-company:id:101';jd=self.store.read()['jobs'][key]['current']['jd']
  r={'score':4,'jd_hash':jd_hash(jd),'reasons':['相关'],'gaps':[],'quotes':['不存在的原文'],'experience_refs':[{'id':'knowledge-assistant','version':1}]}
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:review_job(s,key,r))
  r['quotes']=['维护检索与引用链路'];self.store.update(lambda s:review_job(s,key,r))
 def test_dashboard_escapes_untrusted_text(self):
  scan=copy.deepcopy(self.first);scan['records'][0]['jd']='</script><script>alert(1)</script>'
  self.store.update(lambda s:ingest_scan(s,scan));text=Path(render_dashboard(self.store)['output']).read_text()
  self.assertNotIn('</script><script>alert(1)',text);self.assertIn('\\u003c/script>',text)
 def test_negotiation(self):
  r=registry();self.assertEqual(negotiate(r['tencent'],r['codex-chrome'])['gate'],'PASS')
  b=copy.deepcopy(r['codex-chrome']);b['capabilities']=[];self.assertEqual(negotiate(r['tencent'],b)['gate'],'REJECT')
 def test_manual_jd_status_unknown(self):
  f=self.store.root/'jd.txt';f.write_text('用户提供的完整职责与要求')
  r=subprocess.run([sys.executable,'-m','job_workbench','--data',str(self.store.root),'add-jd',str(f),'--title','工程师','--company','企业','--url','https://careers.example.org/job/1','--complete'],capture_output=True,text=True,cwd=ROOT)
  self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(next(iter(self.store.read()['jobs'].values()))['current']['status'],'unknown')

 def test_sparse_observation_retains_original_jd_evidence(self):
  self.store.update(lambda s:ingest_scan(s,self.first))
  self.store.update(lambda s:ingest_scan(s,self.second))
  j=self.store.read()['jobs']['demo-company:id:102']['current']
  self.assertEqual(j['jd_observed_at'],'2026-10-21T08:00:00+08:00')
  self.assertIn('SQL',j['jd_evidence']['text'])
  self.assertEqual(j['evidence']['kind'],'closed')
 def test_city_scope_and_complete_chunk_history(self):
  scan=copy.deepcopy(self.first);scan['query']['city']='上海'
  self.store.update(lambda s:ingest_scan(s,scan))
  checks=next(iter(self.store.read()['jobs']['demo-company:id:101']['search_scopes'].values()))['checks']
  self.assertEqual(checks['city'],'fail')
  tail=copy.deepcopy(scan);tail.update(id='tail',records=[],seen_urls=[j['url'] for j in scan['records']])
  self.assertEqual(self.store.update(lambda s:ingest_scan(s,tail))['changes'],[])

 def test_import_source_and_saved_parent_are_distinct(self):
  self.library();source=self.store.root/'old.txt';source.write_text('合成旧简历')
  imported=import_resume(self.store,source)
  with self.assertRaisesRegex(WorkbenchError,'--source-import'):
   draft_resume(self.store.read(),'AI 应用',parent_id=imported['id'])
  draft=draft_resume(self.store.read(),'AI 应用',source_import_id=imported['id'])
  first=self.store.update(lambda s:save_resume(s,draft,True))
  newer=draft_resume(self.store.read(),'AI 应用',parent_id=first['id'])
  self.assertEqual(newer['source_import_id'],imported['id'])
  newer['entries'][0]['bullets'][0]='合成改写，需由用户确认'
  second=self.store.update(lambda s:save_resume(s,newer,True))
  diff=resume_diff(self.store.read(),second)
  self.assertIn('+',diff);self.assertIn('合成改写',diff)
  bad=copy.deepcopy(draft);bad['source_import_id']='missing'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:save_resume(s,bad,True))

 def test_custom_export_is_linked_and_diff_exported(self):
  self.library();draft=draft_resume(self.store.read(),'AI 应用');first=self.store.update(lambda s:save_resume(s,draft,True))
  draft=draft_resume(self.store.read(),'后端开发',parent_id=first['id']);second=self.store.update(lambda s:save_resume(s,draft,True))
  out=self.store.root/'custom';result=export_resume(self.store,second['id'],out)
  self.assertEqual((out/'resume.pdf').read_bytes(),(self.store.root/'exports'/second['id']/'resume.pdf').read_bytes())
  self.assertIn('系统比较',(out/'changes.md').read_text());self.assertIn('+目标：后端开发',(out/'changes.md').read_text())
  html=Path(render_dashboard(self.store)['output']).read_text()
  self.assertIn(f'resumes/{second["id"]}/resume.pdf',html)
  self.assertTrue(Path(result['paths']['resume.pdf']).is_absolute())

 def test_answer_semantic_fallback_and_dynamic_recheck(self):
  self.store.update(lambda s:put_entry(s,'answers','why',read_json(ROOT/'examples/answer.json'),True))
  answer=find_answer(self.store.read(),'这份职位最吸引你的地方是什么？','AI 应用工程师')[0]
  self.assertEqual(answer['reuse'],'draft_review_required');self.assertEqual(answer['match'],'semantic_review_required')
  self.assertIn('question',answer);self.assertIn('updated_at',answer)
  q={'question':'薪资和到岗时间？','answer':'合成薪资 20k，11 月到岗','context':'AI 应用工程师'}
  self.store.update(lambda s:put_entry(s,'answers','salary',q,True))
  answer=find_answer(self.store.read(),q['question'],q['context'])[0]
  self.assertTrue(answer['requires_recheck']);self.assertEqual(answer['reuse'],'draft_review_required')
  self.assertEqual(len(find_answer(self.store.read(),'换个问法',all_candidates=True)),2)

 def test_profile_is_a_draft_prerequisite_and_conflict_guides_merge(self):
  q=self.store.update(lambda s:interview(s,'new','AI 应用'));self.assertIn('profile',[x['id'] for x in q['questions']]);self.assertFalse(q['can_draft'])
  self.store.update(lambda s:put_entry(s,'experiences','a',read_json(ROOT/'examples/experience.json'),True))
  self.assertFalse(self.store.update(lambda s:interview(s,'new'))['can_draft'])
  self.store.update(lambda s:put_entry(s,'profiles','personal',read_json(ROOT/'examples/profile.json'),True))
  self.assertTrue(self.store.update(lambda s:interview(s,'new'))['can_draft'])
  with self.assertRaisesRegex(WorkbenchError,'show experiences a'):
   self.store.update(lambda s:put_entry(s,'experiences','a',{},True,0))

 def test_share_excludes_private_history_without_mutating_source(self):
  self.library();self.store.update(lambda s:ingest_scan(s,self.first))
  secret='PRIVATE_SENTINEL_OLD_VERSION';entry=read_json(ROOT/'examples/experience.json');entry['result']=secret
  self.store.update(lambda s:put_entry(s,'experiences','knowledge-assistant',entry,True,1))
  self.store.update(lambda s:restore_entry(s,'experiences','knowledge-assistant',1))
  draft=draft_resume(self.store.read(),'AI 应用');self.store.update(lambda s:save_resume(s,draft,True))
  self.store.update(lambda s:decide(s,'demo-company:id:101','shortlist',secret))
  before=self.store.read();private=Path(render_dashboard(self.store)['output']).read_text();self.assertIn(secret,private)
  shared=Path(render_dashboard(self.store,share=True)['output']).read_text();self.assertNotIn(secret,shared);self.assertNotIn('linzhou@example.com',shared)
  payload=json.loads(shared.split('<script type="application/json" id="data">')[1].split('</script>')[0])
  for key in ['experiences','resumes','answers','applications']:self.assertFalse(payload[key])
  self.assertEqual(payload['jobs']['demo-company:id:101']['decision'],'undecided')
  self.assertEqual(self.store.read(),before)
  with self.assertRaises(WorkbenchError):render_dashboard(self.store,self.store.root/'report/index.html',share=True)

 def test_partial_scope_and_retry_details_survive_ingest(self):
  self.store.update(lambda s:ingest_scan(s,self.first))
  part=copy.deepcopy(self.first);part.update(id='part',gate='RETRY',coverage='partial',code='RATE_LIMIT',retryAfter=30,retry_attempts=1,next_action='等待再继续',records=self.first['records'][:1])
  self.store.update(lambda s:ingest_scan(s,part));saved=self.store.read()['scans']['part']
  self.assertEqual(saved['retryAfter'],30);self.assertEqual(saved['code'],'RATE_LIMIT')
  self.assertEqual(len(saved['scope_summary']['observed_keys']),1);self.assertEqual(len(saved['scope_summary']['unobserved_keys']),2)

 def test_requirement_mapping_cannot_invent_quotes_or_refs(self):
  self.library();self.store.update(lambda s:ingest_scan(s,self.first));key='demo-company:id:101'
  ref={'id':'knowledge-assistant','version':1}
  r={'score':4,'jd_hash':jd_hash(self.store.read()['jobs'][key]['current']['jd']),'reasons':['相关'],'gaps':[],'quotes':['维护检索与引用链路'],'experience_refs':[ref],
     'requirements':[{'quote':'维护检索与引用链路','assessment':'合成经历支持','experience_refs':[ref],'gap':'规模经验待补'}]}
  self.store.update(lambda s:review_job(s,key,r));r['requirements'][0]['quote']='伪造要求'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:review_job(s,key,r))

 def test_parent_keeps_edits_selection_order_and_old_sources_until_explicit_rebuild(self):
  self.library()
  extra=read_json(ROOT/'examples/experience.json');extra['title']='第二段经历'
  self.store.update(lambda s:put_entry(s,'experiences','extra',extra,True))
  draft=draft_resume(self.store.read(),'旧方向',experience_ids=['extra','knowledge-assistant'])
  draft['entries'].pop();draft['entries'][0]['bullets']=['已核对的定制文案'];draft['change_notes']=['保留必要限定']
  first=self.store.update(lambda s:save_resume(s,draft,True))
  extra['result']='新确认的成果';self.store.update(lambda s:put_entry(s,'experiences','extra',extra,True,1))
  s=self.store.read();continued=draft_resume(s,'新方向',parent_id=first['id'])
  self.assertEqual(continued['entries'],draft['entries']);self.assertEqual(continued['change_notes'],draft['change_notes'])
  self.assertEqual(continued['profile_version'],draft['profile_version']);self.assertEqual(s['resumes'][first['id']]['draft'],draft)
  self.assertEqual(source_updates(s,continued)[0]['latest_version'],2)
  with self.assertRaisesRegex(WorkbenchError,'--rebuild'):draft_resume(s,'新方向',['extra'],first['id'])
  rebuilt=draft_resume(s,'新方向',['extra'],first['id'],rebuild=True)
  self.assertEqual(rebuilt['entries'][0]['experience_version'],2);self.assertIn('新确认的成果',rebuilt['entries'][0]['bullets'])
  self.assertEqual(source_updates(s,rebuilt),[])

 def test_removed_plans_preserve_legacy_data_but_have_no_active_surface(self):
  self.library();self.assertNotIn('plans',self.store.read())
  legacy={'practice':[{'version':1,'confirmed':True,'data':{'title':'LEGACY_PRIVATE_PLAN'}}]}
  self.store.update(lambda s:s.update(plans=legacy))
  before=self.store.path.read_bytes()
  for share in [False,True]:
   html=Path(render_dashboard(self.store,share=share)['output']).read_text()
   self.assertNotIn('LEGACY_PRIVATE_PLAN',html);self.assertNotIn('data-view="plans"',html)
   self.assertNotIn('待补经历',html)
  self.assertEqual(self.store.path.read_bytes(),before)
  for fn in [lambda s:put_entry(s,'plans','new',{},True),lambda s:restore_entry(s,'plans','practice',1)]:
   with self.assertRaises(WorkbenchError):self.store.update(fn)
  self.assertEqual(self.store.path.read_bytes(),before)
  q=self.store.update(lambda s:interview(s,'continue','供应链分析',industry='supply-chain',segment='campus'))
  self.assertNotIn('open_plans',q);self.assertNotIn('实践计划',str(q));self.assertTrue(Path(q['industry_guide']).is_file())
  self.assertEqual(self.store.read()['plans'],legacy)
  self.assertNotIn('LEGACY_PRIVATE_PLAN',json.dumps(draft_resume(self.store.read(),'供应链分析')))
  r=subprocess.run([sys.executable,'-m','job_workbench','--data',str(self.store.root),'library-put','plans','new','unused.json'],capture_output=True,text=True,cwd=ROOT)
  self.assertNotEqual(r.returncode,0);self.assertIn('invalid choice',r.stderr)

 def test_facts_qualifiers_and_credentials_export_without_private_notes(self):
  self.library();experience=read_json(ROOT/'examples/experience-facts.json');profile=read_json(ROOT/'examples/profile-credentials.json')
  experience['facts']['metrics'].append({'name':'PRIVATE_METRIC','status':'actual','value':'123','disclosure':'private'})
  experience['pending_notes']=['PRIVATE_PENDING_NOTE'];experience['facts']['evidence_refs'][0]['reference']='PRIVATE_EVIDENCE_LOCATION'
  self.store.update(lambda s:put_entry(s,'profiles','personal',profile,True,1))
  self.store.update(lambda s:put_entry(s,'experiences','knowledge-assistant',experience,True,1))
  draft=draft_resume(self.store.read(),'AI 应用');bad=copy.deepcopy(draft);bad['entries'][0].pop('fact_context')
  with self.assertRaisesRegex(WorkbenchError,'事实限定'):self.store.update(lambda s:save_resume(s,bad,True))
  saved=self.store.update(lambda s:save_resume(s,draft,True));out=Path(export_resume(self.store,saved['id'])['directory'])
  md=(out/'resume.md').read_text();self.assertIn('目标值',md);self.assertIn('内部试用',md);self.assertIn('培训：实验数据记录培训',md)
  for secret in ['PRIVATE_METRIC','PRIVATE_PENDING_NOTE','PRIVATE_EVIDENCE_LOCATION','未取得的目标证书']:self.assertNotIn(secret,md)
  private=Path(render_dashboard(self.store)['output']).read_text();self.assertIn('PRIVATE_PENDING_NOTE',private)
  share=Path(render_dashboard(self.store,share=True)['output']).read_text()
  self.assertNotIn('PRIVATE_METRIC',share);self.assertNotIn('实验数据记录培训',share)
  from zipfile import ZipFile
  from xml.etree import ElementTree as ET
  from uuid import UUID
  with ZipFile(out/'resume.docx') as z:
   ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
   table=ET.fromstring(z.read('word/fontTable.xml'));embedded=table.find('.//w:embedRegular',ns)
   key=UUID(embedded.attrib['{'+ns['w']+'}fontKey']).bytes[::-1]
   raw=bytearray(z.read('word/fonts/NotoSansSC-Regular.odttf'))
   for i in range(32):raw[i]^=key[i%16]
   self.assertEqual(bytes(raw),(ROOT/'assets/fonts/NotoSansSC-Regular.ttf').read_bytes())
   self.assertIn('目标值',z.read('word/document.xml').decode())

 def test_optional_fact_validation(self):
  self.library();bad=read_json(ROOT/'examples/experience-facts.json');bad['facts']['metrics'][0]['status']='achieved_maybe'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:put_entry(s,'experiences','bad',bad,True))
  bad=read_json(ROOT/'examples/profile-credentials.json');bad['credentials'][0]['kind']='license_assumed'
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:put_entry(s,'profiles','other',bad,True))

 def test_all_industry_guides_route_without_forcing_extra_questions(self):
  guides=list((ROOT/'skills/scientific-interview/references/industries').glob('*.md'))
  self.assertEqual(len(guides),11)
  for guide in guides:
   if guide.stem=='index':continue
   q=self.store.update(lambda s:interview(s,guide.stem,'目标方向',industry=guide.stem,segment='experienced'))
   self.assertLessEqual(len(q['questions']),3);self.assertEqual(Path(q['industry_guide']),guide)
   again=self.store.update(lambda s:interview(s,guide.stem))
   self.assertEqual(again['industry_guide'],q['industry_guide'])
  with self.assertRaises(WorkbenchError):self.store.update(lambda s:interview(s,'bad',industry='missing'))

 def test_render_directory_explains_file_parameter(self):
  with self.assertRaisesRegex(WorkbenchError,'HTML 文件路径'):render_dashboard(self.store,self.store.root)

if __name__=='__main__':unittest.main()

class StatisticsIntegrationTests(unittest.TestCase):
 def test_unchanged_observation_keeps_activity_clock_and_classification(self):
  (ROOT/"data/tmp").mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(dir=ROOT/"data/tmp") as folder:
   store=Store(folder);store.init()
   first=read_json(ROOT/'examples/scan-first.json');store.update(lambda s:ingest_scan(s,first))
   key='demo-company:id:101'
   store.update(lambda s:classify_job(s,key,'AI 应用','软件'))
   scan=copy.deepcopy(first);scan['id']='new-observation';scan['observed_at']='2026-11-22T08:00:00+08:00'
   for r in scan['records']:
    r['observed_at']=scan['observed_at'];r['evidence']['observed_at']=scan['observed_at']
   store.update(lambda s:ingest_scan(s,scan))
   def payload(share=False):
    text=Path(render_dashboard(store,share=share)['output']).read_text()
    return json.loads(text.split('<script type="application/json" id="data">')[1].split('</script>')[0])
   before=store.path.read_bytes();p=payload();self.assertEqual(store.path.read_bytes(),before)
   self.assertEqual(p['jobs'][key]['last_changed_at'],first['records'][0]['observed_at'])
   self.assertEqual(p['jobs'][key]['classification']['direction'],'AI 应用')
   shared=payload(True);self.assertNotIn('classification',shared['jobs'][key]);self.assertNotIn('classification_history',shared['jobs'][key])
   self.assertEqual(shared['jobs'][key]['last_changed_at'],first['records'][0]['observed_at'])
   scan['id']='changed';scan['records'][0]['jd']+=' 增加职责。'
   store.update(lambda s:ingest_scan(s,scan));self.assertEqual(payload()['jobs'][key]['last_changed_at'],scan['observed_at'])
   store.update(lambda s:classify_job(s,key,industry='企业服务'))
   self.assertEqual(store.read()['jobs'][key]['classification'],{'direction':'AI 应用','industry':'企业服务'})
   with self.assertRaises(WorkbenchError):store.update(lambda s:classify_job(s,key))
   with self.assertRaises(WorkbenchError):store.update(lambda s:classify_job(s,key,industry='x'*101))
