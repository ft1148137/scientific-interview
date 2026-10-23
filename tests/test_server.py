import json
from http.client import HTTPConnection
from pathlib import Path
from threading import Thread
from tempfile import TemporaryDirectory
import unittest
from job_workbench.server import report_server
from job_workbench.store import Store, read_json
from job_workbench.jobs import ingest_scan, record_application
from job_workbench.registry import ROOT
from job_workbench.render import render_dashboard
from job_workbench.library import put_entry

class DecisionServerTests(unittest.TestCase):
 def setUp(self):
  (ROOT/"data/tmp").mkdir(parents=True,exist_ok=True)
  self.tmp=TemporaryDirectory(dir=ROOT/"data/tmp");self.addCleanup(self.tmp.cleanup)
  self.store=Store(self.tmp.name);self.store.init();self.store.update(lambda s:ingest_scan(s,read_json(ROOT/'examples/scan-first.json')))
  render_dashboard(self.store);self.server=report_server(self.store,0);self.thread=Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
  self.addCleanup(self.stop);self.origin=f'http://127.0.0.1:{self.server.server_port}'
  status,payload=self.request('GET','/api/session');self.assertEqual(status,200);self.token=payload['token']
 def stop(self):
  self.server.shutdown();self.server.server_close();self.thread.join()
 def request(self,method,path,body=None,headers=None):
  connection=HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
  connection.request(method,path,json.dumps(body) if body is not None else None,headers or {})
  response=connection.getresponse();raw=response.read();connection.close()
  return response.status,json.loads(raw) if raw.startswith(b'{') else raw.decode()
 def headers(self):return {'Origin':self.origin,'Content-Type':'application/json','X-Workbench-Token':self.token}
 def body(self,decision='shortlist',revision=None):return {'key':'demo-company:id:101','decision':decision,'revision':self.store.read()['revision'] if revision is None else revision}
 def test_persist_switch_cancel_idempotency_and_reloaded_html(self):
  for value in ['shortlist','excluded','undecided']:
   old=self.store.read()['revision'];status,result=self.request('POST','/api/decision',self.body(value),self.headers())
   self.assertEqual(status,200);self.assertEqual(result['decision'],value);self.assertEqual(result['revision'],old+1)
   self.assertEqual(self.store.read()['jobs']['demo-company:id:101']['decision'],value)
   html=(self.store.root/'report/index.html').read_text();payload=json.loads(html.split('<script type="application/json" id="data">')[1].split('</script>')[0]);self.assertEqual(payload['revision'],result['revision']);self.assertEqual(payload['jobs']['demo-company:id:101']['decision'],value)
  before=self.store.path.read_bytes();status,_=self.request('POST','/api/decision',self.body('undecided'),self.headers());self.assertEqual(status,200);self.assertEqual(self.store.path.read_bytes(),before)
  self.assertEqual(len(self.store.read()['jobs']['demo-company:id:101']['decision_history']),3)
 def test_reject_stale_unknown_and_cross_origin_without_mutation(self):
  before=self.store.path.read_bytes()
  attempts=[(self.body(),{},403),(self.body(),{**self.headers(),'Origin':'https://other.example'},403),(self.body(),{**self.headers(),'X-Workbench-Token':'wrong'},403),(self.body(),{**self.headers(),'Host':'other.example'},403),(self.body(revision=0),self.headers(),409),(self.body('invalid'),self.headers(),409),({**self.body(),'key':'missing'},self.headers(),409),({**self.body(),'revision':True},self.headers(),400)]
  for body,headers,expected in attempts:
   status,_=self.request('POST','/api/decision',body,headers);self.assertEqual(status,expected)
   self.assertEqual(self.store.path.read_bytes(),before)
  status,_=self.request('GET','/api/session',headers={'Host':'other.example'});self.assertEqual(status,403)
 def test_main_data_not_served_and_sharing_still_excludes_tags(self):
  status,_=self.request('GET','/../state.json');self.assertEqual(status,404)
  self.request('POST','/api/decision',self.body(),self.headers())
  html=Path(render_dashboard(self.store,share=True)['output']).read_text();payload=json.loads(html.split('<script type="application/json" id="data">')[1].split('</script>')[0]);self.assertEqual(payload['jobs']['demo-company:id:101']['decision'],'undecided');self.assertEqual(payload['jobs']['demo-company:id:101']['decision_history'],[])

 def test_applied_job_rejects_pre_application_tags_and_keeps_history(self):
  self.request('POST','/api/decision',self.body(),self.headers())
  ev={'url':'https://jobs.example.com/jobs/101','observed_at':'2020-01-01T00:00:00Z','text':'申请已提交','kind':'application'}
  self.store.update(lambda s:record_application(s,'demo-company:id:101','submitted',ev))
  self.store.update(lambda s:record_application(s,'demo-company:id:101','unknown',ev))
  before=self.store.path.read_bytes()
  for value in ['shortlist','excluded','undecided']:
   status,result=self.request('POST','/api/decision',self.body(value),self.headers())
   self.assertEqual(status,409);self.assertIn('已投递',result['error'])
  self.assertEqual(self.store.path.read_bytes(),before)
  self.assertEqual(self.store.read()['jobs']['demo-company:id:101']['decision'],'shortlist')
 def test_unknown_application_does_not_remove_pre_application_choice(self):
  ev={'url':'https://jobs.example.com/jobs/101','observed_at':'2020-01-01T00:00:00Z','text':'申请结果待核验','kind':'application'}
  self.store.update(lambda s:record_application(s,'demo-company:id:101','unknown',ev))
  status,result=self.request('POST','/api/decision',self.body(),self.headers())
  self.assertEqual(status,200);self.assertEqual(result['decision'],'shortlist')

 def test_debrief_live_read_sees_cli_writes_and_rejects_foreign_host(self):
  status,first=self.request('GET','/api/debriefs');self.assertEqual(status,200);self.assertEqual(first['debriefs'],{})
  self.store.update(lambda s:put_entry(s,'debriefs','first',read_json(ROOT/'examples/debrief.json'),False))
  status,result=self.request('GET','/api/debriefs');self.assertEqual(status,200)
  self.assertGreater(result['revision'],first['revision']);self.assertFalse(result['debriefs']['first'][0]['confirmed'])
  self.assertNotIn('profiles',result)
  status,_=self.request('GET','/api/debriefs',headers={'Host':'other.example'});self.assertEqual(status,403)
