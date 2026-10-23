"""Historical imports retain evidence gaps without inventing URLs or verification."""
from copy import deepcopy
import unittest
from job_workbench.jobs import ingest_scan
from job_workbench.store import empty_state, WorkbenchError

class LegacyImportTests(unittest.TestCase):
    def batch(self):
        date='2026-09-20T00:00:00+08:00'
        record={'external_id':'old-1','url':None,'company':'Synthetic Company','title':'Engineer','jd':'Archived description','jd_complete':False,'status':'unknown','observed_at':date,'first_seen':'2026-09-01T00:00:00+08:00','evidence':{'url':None,'kind':'user_supplied','text':'Original local record without a source link','observed_at':date}}
        return {'protocol_version':1,'id':'legacy-test','source':'manual','slot_version':'1.0.0','browser_id':'fixture','query':{},'observed_at':date,'gate':'PASS','coverage':'partial','historical':True,'records':[record]}

    def test_missing_urls_keep_distinct_ids_and_historical_dates(self):
        scan=self.batch(); second=deepcopy(scan['records'][0]);second['external_id']='old-2';scan['records'].append(second)
        state=empty_state(); result=ingest_scan(state,scan)
        self.assertFalse(result['rejected']);self.assertEqual(len(state['jobs']),2)
        job=state['jobs']['manual:id:old-1']
        self.assertIsNone(job['current']['url']);self.assertEqual(job['verification'],'needs_recheck')
        self.assertEqual(job['first_seen'],'2026-09-01T00:00:00+08:00')
        self.assertTrue(ingest_scan(state,scan)['idempotent'])

    def test_missing_id_or_future_first_seen_rejected(self):
        for field,value in [('external_id',None),('first_seen','2026-10-01T00:00:00+08:00')]:
            scan=self.batch();scan['records'][0][field]=value
            state=empty_state();self.assertEqual(len(ingest_scan(state,scan)['rejected']),1);self.assertFalse(state['jobs'])

    def test_live_source_cannot_use_local_import_exceptions(self):
        scan=self.batch();scan.update(source='tencent',browser_id='codex-chrome')
        with self.assertRaises(WorkbenchError):ingest_scan(empty_state(),scan)
        scan['historical']=False;scan['records'][0]['evidence']['kind']='page'
        self.assertEqual(len(ingest_scan(empty_state(),scan)['rejected']),1)
