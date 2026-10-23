"""Validate routing, examples and source portability without reading private data."""
from pathlib import Path
import json
import re
import sys
import subprocess
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from job_workbench.registry import registry
from job_workbench.resources import missing_resources
from job_workbench.jobs import ingest_scan
from job_workbench.store import empty_state,read_json

assert not missing_resources(), f"missing source resources: {missing_resources()}"
slots=registry()
for slot in slots.values():
 directory=ROOT/'slots'/('sites' if slot['kind']=='site' else 'browsers')/slot['id']
 assert (directory/slot['entry']).is_file(),f"missing entry: {slot['id']}"
skill=ROOT/'skills/scientific-interview/SKILL.md';text=skill.read_text()
assert text.startswith('---\n') and re.search(r'^name: scientific-interview$',text,re.M)
assert re.search(r'^description: .+',text,re.M)
version=re.search(r'^version = "([^"]+)"', (ROOT/'pyproject.toml').read_text(), re.M)[1]
assert 'name = "scientific-interview"' in (ROOT/'pyproject.toml').read_text(), 'project name drift'
assert '# Scientific Interview' in text, 'Skill display name drift'
for name, alternate in [('README.md', 'README.zh-CN.md'), ('README.zh-CN.md', 'README.md')]:
 readme=(ROOT/name).read_text()
 assert readme.startswith('# Scientific Interview\n'), f'display name drift: {name}'
 assert f'v{version}' in readme and f'v{version}' in text, f'README / Skill version drift: {name}'
 assert f']({alternate})' in readme, f'missing language link: {name}'
assert f'__version__ = "{version}"' in (ROOT/'job_workbench/__init__.py').read_text(), 'package version drift'
assert re.search(r'^## '+re.escape(version)+r'$', (ROOT/'CHANGELOG.md').read_text(), re.M), 'missing changelog version'
assert '/data/' in (ROOT/'.gitignore').read_text().splitlines(), 'data/ must be ignored'
if (ROOT/'.git').exists():
 ignored=subprocess.run(['git','check-ignore','--no-index','data/check.json'],cwd=ROOT,capture_output=True,text=True)
 assert ignored.returncode==0, 'data files are not ignored by Git'
 tracked=subprocess.run(['git','ls-files','--','data'],cwd=ROOT,capture_output=True,text=True,check=True)
 assert not tracked.stdout.strip(), 'runtime data must not be tracked by Git'
documents = list(ROOT.glob('*.md'))
for folder in ['docs', 'skills', 'contracts', 'assets', 'slots']:
 documents.extend((ROOT / folder).rglob('*.md'))
for file in documents:
 for link in re.findall(r'\]\(([^)]+)\)', file.read_text()):
  if '://' in link or link.startswith('#'): continue
  target = link.split('#', 1)[0]
  assert (file.parent / target).exists(), f'broken link {file}: {link}'
for name in ['scan-first.json','scan-second.json']:
 result=ingest_scan(empty_state(),read_json(ROOT/'examples'/name));assert not result['rejected']
for folder in ['job_workbench','skills','slots','templates','examples']:
 for file in (ROOT/folder).rglob('*'):
  if file.is_file() and '__pycache__' not in str(file) and file.name != '.DS_Store':
   content=file.read_text(encoding='utf-8')
   assert not re.search(r'/Users/[^/]+/|/home/[^/]+/',content),f'machine path: {file}'
print(f'OK: {len(slots)} slot manifests, skill routes, synthetic examples, portable source paths')
