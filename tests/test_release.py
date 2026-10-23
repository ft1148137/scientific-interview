"""Release boundaries: ignored archives, accidentally tracked data and symlinks."""
import importlib.util
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_source', ROOT / 'scripts/package_source.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'data/tmp').mkdir(parents=True, exist_ok=True)
        self.tmp = TemporaryDirectory(dir=ROOT / 'data/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        (self.root / '.gitignore').write_text('/data/\n')
        (self.root / 'README.md').write_text('Synthetic project\n')
        (self.root / 'data').mkdir()
        (self.root / 'data/private.json').write_text('{}')
        self.mock = patch.object(release, 'ROOT', self.root)
        self.mock.start()
        self.addCleanup(self.mock.stop)

    def test_untracked_source_included_and_ignored_data_excluded(self):
        self.assertEqual([name for name, _ in release.checked_files()], ['.gitignore', 'README.md'])

    def test_force_added_private_data_rejected(self):
        subprocess.run(['git', 'add', '-f', 'data/private.json'], cwd=self.root, check=True)
        with self.assertRaisesRegex(ValueError, '未批准'):
            release.checked_files()

    def test_path_and_secret_rejected_without_echoing_value(self):
        for content in ['/' + 'Users/' + 'fictional-person/file', 'ghp_' + 'x' * 36]:
            (self.root / 'README.md').write_text(content)
            with self.assertRaises(ValueError) as error:
                release.checked_files()
            self.assertNotIn(content, str(error.exception))

    def test_source_symlink_rejected(self):
        (self.root / 'README.md').unlink()
        (self.root / 'README.md').symlink_to(self.root / 'data/private.json')
        with self.assertRaisesRegex(ValueError, '符号链接'):
            release.checked_files()

    def test_unexpected_root_file_rejected(self):
        (self.root / 'resume.pdf').write_bytes(b'private document')
        with self.assertRaisesRegex(ValueError, '未批准'):
            release.checked_files()
