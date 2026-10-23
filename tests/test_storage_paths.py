import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from job_workbench.cli import data_path, parser
from job_workbench.registry import ROOT
from job_workbench.store import WorkbenchError, Store, atomic_json
from job_workbench.render import render_dashboard


class StoragePathTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'data/tmp').mkdir(parents=True, exist_ok=True)
        self.tmp = TemporaryDirectory(dir=ROOT / 'data/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def command(self, *args, env=None):
        return subprocess.run([sys.executable, str(ROOT / 'skills/scientific-interview/scripts/workbench.py'), *args], cwd=self.root, env=env, capture_output=True, text=True)

    def test_default_and_environment_select_data_inside_checkout(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(data_path(parser().parse_args(['status']).data), ROOT / 'data/main')
        with patch.dict(os.environ, {'JOB_WORKBENCH_DATA': 'data/demo'}):
            self.assertEqual(data_path(parser().parse_args(['status']).data), ROOT / 'data/demo')
        with patch.dict(os.environ, {'SCIENTIFIC_INTERVIEW_DATA': 'data/main', 'JOB_WORKBENCH_DATA': 'data/demo'}):
            self.assertEqual(data_path(parser().parse_args(['status']).data), ROOT / 'data/main')
        self.assertEqual(data_path(str(self.root)), self.root)

    def test_relative_paths_work_from_another_directory(self):
        directory = self.root / 'isolated'
        result = self.command('--data', str(directory.relative_to(ROOT)), 'init')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((directory / 'state.json').is_file())
        output = self.root / 'report/index.html'
        result = self.command('--data', str(directory), 'render', '--out', str(output.relative_to(ROOT)))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(output.is_file())
        self.assertFalse((self.root / 'data').exists())

    def test_rejects_traversal_source_outputs_and_symlink_escape(self):
        for value in ['.', 'README.md', 'data/../templates/output.html', str(ROOT.parent / 'outside')]:
            with self.assertRaises(WorkbenchError):
                data_path(value)
        link = self.root / 'escape'
        link.symlink_to(ROOT / 'templates', target_is_directory=True)
        with self.assertRaises(WorkbenchError):
            data_path(link / 'output.html')
        before = (ROOT / 'README.md').read_bytes()
        for command in [('render', '--out', 'README.md'), ('resume-draft', '--target', 'test', '--out', 'README.md'), ('resume-export', 'missing', '--out', 'templates')]:
            result = self.command('--data', str(self.root), *command)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('data/', result.stderr)
        self.assertEqual((ROOT / 'README.md').read_bytes(), before)
        self.assertFalse((self.root / 'state.json').exists())

    def test_legacy_environment_is_explicit_error_but_doctor_is_read_only(self):
        env = {k: v for k, v in os.environ.items() if k != 'SCIENTIFIC_INTERVIEW_DATA'}
        env['JOB_WORKBENCH_DATA'] = str(ROOT.parent / 'old-private-store')
        result = self.command('init', env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('迁移', result.stderr)
        result = self.command('doctor', env=env)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_direct_storage_and_render_cannot_bypass_data_boundary(self):
        with self.assertRaises(WorkbenchError):
            Store(ROOT / 'templates')
        with self.assertRaises(WorkbenchError):
            atomic_json(ROOT / 'outside.json', {'test': True})
        store = Store(self.root)
        store.init()
        with self.assertRaises(WorkbenchError):
            render_dashboard(store, ROOT / 'README.md')
        (self.root / 'originals').symlink_to(ROOT / 'templates', target_is_directory=True)
        with self.assertRaises(WorkbenchError):
            store.blob(b'test input')
