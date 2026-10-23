"""Source-linked installation preserves existing content and diagnoses incomplete sources."""
import importlib.util
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from job_workbench.resources import ROOT, missing_resources
from job_workbench.cli import doctor
from job_workbench.store import WorkbenchError

spec = importlib.util.spec_from_file_location('install_skill', ROOT / 'scripts/install_skill.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallationTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'data/tmp').mkdir(parents=True, exist_ok=True)
        self.temp = TemporaryDirectory(dir=ROOT / 'data/tmp')
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.destination = self.directory / 'skills'
        self.target = self.destination / 'scientific-interview'

    def test_check_is_read_only_and_install_is_idempotent(self):
        with self.assertRaises(ValueError):
            installer.install(self.destination, check=True)
        self.assertFalse(self.destination.exists())
        installer.install(self.destination)
        before = self.target.lstat().st_mtime_ns
        installer.install(self.destination)
        installer.install(self.destination, check=True)
        self.assertEqual(before, self.target.lstat().st_mtime_ns)
        self.assertEqual(self.target.resolve(), installer.SKILL_DIR)

    def test_repair_live_and_broken_links_requires_explicit_flag(self):
        self.destination.mkdir()
        for old in [self.directory / 'old-source', self.directory / 'missing-source']:
            if old.name == 'old-source':
                old.mkdir()
                (old / 'keep.txt').write_text('unchanged')
            self.target.symlink_to(old, target_is_directory=True)
            with self.assertRaises(ValueError):
                installer.install(self.destination)
            self.assertEqual(Path(os.readlink(self.target)), old)
            installer.install(self.destination, repair=True)
            self.assertEqual(self.target.resolve(), installer.SKILL_DIR)
            self.target.unlink()
        self.assertEqual((self.directory / 'old-source/keep.txt').read_text(), 'unchanged')

    def test_repair_never_overwrites_regular_files_or_directories(self):
        self.destination.mkdir()
        self.target.write_text('keep file')
        with self.assertRaises(ValueError):
            installer.install(self.destination, repair=True)
        self.assertEqual(self.target.read_text(), 'keep file')
        self.target.unlink()
        self.target.mkdir()
        (self.target / 'keep.txt').write_text('keep directory')
        with self.assertRaises(ValueError):
            installer.install(self.destination, repair=True)
        self.assertEqual((self.target / 'keep.txt').read_text(), 'keep directory')

    def test_failed_replacement_preserves_old_link(self):
        self.destination.mkdir()
        old = self.directory / 'missing-source'
        self.target.symlink_to(old, target_is_directory=True)
        with patch.object(Path, 'replace', side_effect=OSError('simulated failure')):
            with self.assertRaises(OSError):
                installer.install(self.destination, repair=True)
        self.assertEqual(Path(os.readlink(self.target)), old)
        self.assertEqual(list(self.destination.iterdir()), [self.target])

    def test_missing_resources_prevent_install_and_doctor_with_actionable_error(self):
        with patch('job_workbench.resources.TEMPLATES_DIR', self.directory / 'missing-templates'):
            self.assertTrue(any(name.endswith('dashboard.html') for name in missing_resources()))
            with self.assertRaisesRegex(ValueError, '完整项目'):
                installer.install(self.destination)
            with self.assertRaisesRegex(WorkbenchError, '完整项目'):
                doctor()
        self.assertFalse(self.destination.exists())
