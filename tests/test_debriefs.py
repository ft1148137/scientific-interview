import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from job_workbench.store import Store, WorkbenchError, read_json
from job_workbench.registry import ROOT
from job_workbench.library import put_entry, restore_entry
from job_workbench.jobs import ingest_scan, review_job
from job_workbench.contracts import jd_hash
from job_workbench.debriefs import debrief_context
from job_workbench.resumes import draft_resume, save_resume, source_updates, export_resume
from job_workbench.render import render_dashboard


class DebriefTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "data/tmp").mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT / "data/tmp")
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.store.init()
        self.record = read_json(ROOT / 'examples/debrief.json')

    def save(self, data=None, confirmed=True, version=None):
        return self.store.update(lambda s: put_entry(s, 'debriefs', 'first', data or self.record, confirmed, version))

    def facts(self):
        self.store.update(lambda s: put_entry(s, 'profiles', 'personal', read_json(ROOT / 'examples/profile.json'), True))
        self.store.update(lambda s: put_entry(s, 'experiences', 'project', read_json(ROOT / 'examples/experience.json'), True))

    def payload(self, share=False):
        html = Path(render_dashboard(self.store, share=share)['output']).read_text()
        return json.loads(html.split('<script type="application/json" id="data">')[1].split('</script>')[0])

    def test_old_store_draft_confirmation_conflict_restore_and_deleted(self):
        self.store.update(lambda s: s.pop('debriefs'))
        self.save(confirmed=False)
        self.assertEqual(debrief_context(self.store.read())['candidates'], [])
        self.save(version=1)
        self.assertEqual(debrief_context(self.store.read())['candidates'][0]['version'], 2)
        before = self.store.path.read_bytes()
        with self.assertRaisesRegex(WorkbenchError, '版本冲突'):
            self.save(version=1)
        self.assertEqual(self.store.path.read_bytes(), before)
        self.save({**self.record, 'deleted': True}, version=2)
        self.assertFalse(debrief_context(self.store.read())['candidates'])
        self.store.update(lambda s: restore_entry(s, 'debriefs', 'first', 2))
        self.assertEqual(debrief_context(self.store.read())['candidates'][0]['version'], 4)

    def test_validation_requires_traceable_analysis_but_allows_partial_recollection(self):
        for bad in [dict(self.record, date='yesterday'), dict(self.record, job_key='missing'), dict(self.record, strengths=[{'point':'优秀', 'basis':'没有说过', 'source':'ai_inference'}]), dict(self.record, strengths=[{'point':'反馈', 'basis':'比较了两种方案', 'source':'interviewer_feedback'}])]:
            with self.assertRaises(WorkbenchError):
                self.save(bad)
        self.save({'company':'未收录企业', 'role':'工程师', 'recollection':'记得被问到项目边界，其他待补。'}, confirmed=False)
        self.assertFalse(self.store.read()['applications'])

    def test_resume_context_refs_and_private_export(self):
        self.facts()
        self.record['recollection'] += ' PRIVATE_DEBRIEF_SENTINEL'
        self.save(confirmed=False)
        draft = draft_resume(self.store.read(), '工程师')
        draft.update(debrief_refs=[{'id':'first','version':1}], debrief_notes='根据复盘调整项目表达')
        with self.assertRaisesRegex(WorkbenchError, '已核对'):
            self.store.update(lambda s: save_resume(s, draft, True))
        self.save(version=1)
        draft['debrief_refs'][0]['version'] = 2
        saved = self.store.update(lambda s: save_resume(s, draft, True))
        self.save(version=2)
        changes = source_updates(self.store.read(), draft)
        self.assertEqual(changes[0]['collection'], 'debriefs')
        self.assertEqual(changes[0]['latest_version'], 3)
        export_resume(self.store, saved['id'])
        exported = (self.store.root / 'exports' / saved['id'] / 'resume.md').read_text()
        self.assertNotIn('PRIVATE_DEBRIEF_SENTINEL', exported)
        self.assertNotIn('debrief_refs', exported)
        self.assertEqual(self.store.read()['resumes'][saved['id']]['draft']['debrief_refs'][0]['version'], 2)

    def test_review_requires_experience_and_invalidates_after_debrief_update(self):
        self.facts()
        self.store.update(lambda s: ingest_scan(s, read_json(ROOT / 'examples/scan-first.json')))
        key = 'demo-company:id:101'
        self.record['job_key'] = key
        self.save()
        jd = self.store.read()['jobs'][key]['current']['jd']
        review = {'score':4, 'jd_hash':jd_hash(jd), 'reasons':['有项目依据，复盘补充表达情况'], 'gaps':['评估能力仍待核实'], 'quotes':[jd], 'experience_refs':[{'id':'project','version':1}], 'debrief_refs':[{'id':'first','version':1}], 'debrief_notes':'仅参考与评估要求相关的回答，不能据此断定不会评估'}
        for bad in [{**review, 'experience_refs':[]}, {**review,'debrief_notes':''}, {**review,'debrief_refs':[{'id':'first','version':7}]}]:
            with self.assertRaises(WorkbenchError):
                self.store.update(lambda s: review_job(s, key, bad))
        self.store.update(lambda s: review_job(s, key, review))
        self.assertFalse(self.payload()['jobs'][key]['review_stale'])
        self.assertTrue(debrief_context(self.store.read(), job_key=key)['candidates'][0]['same_job'])
        self.save(version=1)
        self.assertTrue(self.payload()['jobs'][key]['review_stale'])
        self.assertEqual(self.store.read()['jobs'][key]['reviews'][0]['score'], 4)

    def test_private_render_escape_and_share_exclusion(self):
        self.record['recollection'] += ' </script><img src=x onerror=alert(1)> PRIVATE_DEBRIEF'
        self.save()
        private = Path(render_dashboard(self.store)['output']).read_text()
        self.assertNotIn('</script><img', private)
        shared = Path(render_dashboard(self.store, share=True)['output']).read_text()
        self.assertNotIn('PRIVATE_DEBRIEF', shared)
        self.assertFalse(self.payload(share=True)['debriefs'])

    def test_cli_save_renders_and_resume_draft_returns_context(self):
        self.facts()
        def run(*args):
            r = subprocess.run([sys.executable, '-m', 'job_workbench', '--data', str(self.store.root), *args], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            return json.loads(r.stdout)
        result = run('library-put', 'debriefs', 'first', str(ROOT / 'examples/debrief.json'), '--confirmed')
        self.assertTrue(Path(result['report']['output']).exists())
        draft = run('resume-draft', '--target', 'AI 应用', '--out', str(self.store.root / 'draft.json'))
        self.assertEqual(draft['debrief_context']['candidates'][0]['id'], 'first')
        context = run('debrief-context', '--target', 'AI 应用')
        self.assertEqual(context['candidates'][0]['version'], 1)
