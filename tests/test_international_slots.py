"""Synthetic international import checks; no captured website or account data."""
import unittest
from copy import deepcopy
from job_workbench.jobs import ingest_scan, save_search
from job_workbench.registry import registry
from job_workbench.store import empty_state


class InternationalImports(unittest.TestCase):
    def test_linkedin_defaults_are_versioned_and_reusable(self):
        import json
        from job_workbench.resources import ROOT
        state = empty_state()
        query = json.loads((ROOT / 'examples/linkedin-search.json').read_text())
        saved = save_search(state, 'linkedin-default', query)
        self.assertEqual(save_search(state, 'linkedin-default', query), saved)
        changed = {**query, 'city': 'Synthetic Region'}
        save_search(state, 'linkedin-default', changed)
        versions = state['searches']['linkedin-default']
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0]['data']['city'], query['city'])
        self.assertEqual(versions[1]['data']['city'], 'Synthetic Region')

    def scan(self, source='openai'):
        site = registry()[source]
        url = site['entry_url'] + '/00000000-0000-0000-0000-000000000001'
        when = '2026-10-26T00:00:00Z'
        return dict(protocol_version=1, id='synthetic-' + source, source=source,
                    slot_version=site['version'], browser_id='tabbit', query={},
                    observed_at=when, gate='PASS', coverage='partial', records=[dict(
                        external_id='synthetic-1', title='Synthetic Engineer',
                        company=site.get('company', 'Synthetic Employer'), url=url,
                        jd='Synthetic responsibilities and requirements', jd_complete=False,
                        status='open', observed_at=when,
                        evidence=dict(url=url, observed_at=when, text='Synthetic evidence', kind='page'))])

    def test_shared_ats_tenant_and_company_are_enforced_at_import(self):
        for source, other in [('openai', 'https://jobs.ashbyhq.com/other/123'),
                              ('anthropic', 'https://job-boards.greenhouse.io/other/jobs/123')]:
            for field in ['url', 'company']:
                scan = self.scan(source)
                if field == 'url':
                    scan['records'][0]['url'] = other
                    scan['records'][0]['evidence']['url'] = other
                else:
                    scan['records'][0]['company'] = 'Synthetic Impostor'
                state = empty_state()
                self.assertEqual(len(ingest_scan(state, scan)['rejected']), 1)
                self.assertFalse(state['jobs'])

    def test_multiple_locations_do_not_duplicate_a_single_stripe_job(self):
        state = empty_state()
        first = self.scan('stripe')
        first['records'][0]['location'] = 'Synthetic City A; Synthetic City B'
        self.assertFalse(ingest_scan(state, first)['rejected'])
        self.assertTrue(ingest_scan(state, first)['idempotent'])
        later = deepcopy(first)
        later['id'] += '-updated'
        later['records'][0]['location'] += '; Synthetic City C'
        self.assertFalse(ingest_scan(state, later)['rejected'])
        self.assertEqual(len(state['jobs']), 1)
        self.assertEqual(len(next(iter(state['jobs'].values()))['snapshots']), 2)

    def test_partial_platform_scan_preserves_original_employer_and_open_status(self):
        state = empty_state()
        scan = self.scan('indeed')
        self.assertFalse(ingest_scan(state, scan)['rejected'])
        empty = deepcopy(scan)
        empty.update(id='synthetic-empty', records=[])
        ingest_scan(state, empty)
        job = next(iter(state['jobs'].values()))['current']
        self.assertEqual(job['company'], 'Synthetic Employer')
        self.assertEqual(job['status'], 'open')
        self.assertFalse(job['jd_complete'])
