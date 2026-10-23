"""Synthetic import boundary checks for shared-host tenants."""
import unittest
from copy import deepcopy
from job_workbench.registry import registry
from job_workbench.store import empty_state, WorkbenchError
from job_workbench.jobs import ingest_scan
from job_workbench.contracts import manifest


class InternetSlots(unittest.TestCase):
    def scan(self, source):
        site = registry()[source]
        url = site['entry_url'].replace('#/jobs', '#/job/synthetic-123')
        when = '2026-10-22T00:00:00Z'
        return dict(protocol_version=1, id='synthetic-' + source, source=source,
                    slot_version=site['version'], browser_id='codex-chrome', query={},
                    observed_at=when, gate='PASS', coverage='partial', records=[dict(
                        external_id='synthetic-123', title='合成工程师', company=site.get('company', '腾讯'),
                        url=url, jd='合成测试职责和要求', jd_complete=True, status='open',
                        observed_at=when, evidence=dict(url=url, observed_at=when,
                                                       text='合成测试证据', kind='page'))])

    def test_tenants_with_same_job_id_are_distinct(self):
        state = empty_state()
        for source in ['moka-kimi', 'moka-zhipu', 'moka-step']:
            self.assertFalse(ingest_scan(state, self.scan(source))['rejected'])
        self.assertEqual(len(state['jobs']), 3)

    def test_cross_tenant_company_and_missing_id_rejected(self):
        for case in ['tenant', 'company', 'id', 'traversal', 'encoded']:
            scan = self.scan('moka-kimi')
            record = scan['records'][0]
            if case == 'tenant':
                record['url'] = self.scan('moka-zhipu')['records'][0]['url']
                record['evidence']['url'] = record['url']
            elif case in {'traversal', 'encoded'}:
                suffix = '/../other' if case == 'traversal' else '/%2e%2e/other'
                record['url'] = record['url'].replace('#/job/', suffix + '#/job/')
                record['evidence']['url'] = record['url']
            elif case == 'company':
                record['company'] = '合成冒名企业'
            else:
                record['external_id'] = None
            state = empty_state()
            self.assertEqual(len(ingest_scan(state, scan)['rejected']), 1)
            self.assertFalse(state['jobs'])

    def test_manifest_requires_entry_within_tenant_scope(self):
        bad = deepcopy(registry()['moka-kimi'])
        bad['path_prefix'] = '/social-recruitment/other/123'
        with self.assertRaises(WorkbenchError):
            manifest(bad)

    def test_shared_url_seen_ids_do_not_mark_other_jobs_seen(self):
        state = empty_state()
        scan = self.scan('jd')
        scan['coverage'] = 'complete'
        scan['records'][0]['external_id'] = '101'
        second = deepcopy(scan['records'][0])
        second['external_id'] = '102'
        scan['records'].append(second)
        self.assertFalse(ingest_scan(state, scan)['rejected'])
        self.assertEqual(len(state['jobs']), 2)
        tail = deepcopy(scan)
        tail.update(id='synthetic-jd-tail', records=[], seen_ids=['101'],
                    seen_urls=[second['url']])
        result = ingest_scan(state, tail)
        self.assertEqual(state['scans'][tail['id']]['seen'], ['jd:id:101'])
        self.assertEqual(state['jobs']['jd:id:102']['verification'], 'needs_recheck')
        self.assertEqual(state['jobs']['jd:id:102']['current']['status'], 'open')
        self.assertEqual(result['changes'][0]['type'], 'needs_recheck')

    def test_shared_url_requires_id_and_seen_ids_have_a_typed_contract(self):
        scan = self.scan('jd')
        scan['records'][0]['external_id'] = None
        self.assertEqual(len(ingest_scan(empty_state(), scan)['rejected']), 1)
        for value in ['101', [101], ['']]:
            bad = self.scan('jd')
            bad.update(records=[], seen_ids=value)
            with self.assertRaises(WorkbenchError):
                ingest_scan(empty_state(), bad)

    def test_campus_sources_are_separate_and_reject_social_urls(self):
        for source in ['bytedance', 'xiaohongshu', 'tencent', 'jd', 'didi', 'kuaishou', 'moka-kimi', 'moka-zhipu', 'moka-step']:
            state = empty_state()
            self.assertFalse(ingest_scan(state, self.scan(source))['rejected'])
            self.assertFalse(ingest_scan(state, self.scan(source + '-campus'))['rejected'])
            self.assertEqual(len(state['jobs']), 2)
            bad = self.scan(source + '-campus')
            bad['id'] += '-bad'
            bad['records'][0]['url'] = registry()[source]['entry_url']
            bad['records'][0]['evidence']['url'] = bad['records'][0]['url']
            self.assertEqual(len(ingest_scan(state, bad)['rejected']), 1)
            reverse = self.scan(source)
            reverse['id'] += '-campus-url'
            reverse['records'][0]['url'] = registry()[source + '-campus']['entry_url']
            reverse['records'][0]['evidence']['url'] = reverse['records'][0]['url']
            self.assertEqual(len(ingest_scan(state, reverse)['rejected']), 1)
