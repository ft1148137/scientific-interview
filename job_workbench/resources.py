"""Resource locations for the supported full-source installation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
SLOTS_DIR = ROOT / 'slots'
TEMPLATES_DIR = ROOT / 'templates'
EXAMPLES_DIR = ROOT / 'examples'
SKILL_DIR = ROOT / 'skills' / 'scientific-interview'
INDUSTRIES_DIR = SKILL_DIR / 'references' / 'industries'
FONT_FILE = ROOT / 'assets' / 'fonts' / 'NotoSansSC-Regular.ttf'


def missing_resources():
    required = [SLOTS_DIR / 'registry.json', SKILL_DIR / 'SKILL.md',
                SKILL_DIR / 'scripts' / 'workbench.py', INDUSTRIES_DIR / 'index.md', FONT_FILE]
    required += [TEMPLATES_DIR / name for name in ('dashboard.html', 'statistics.js', 'statistics-view.js')]
    required += [EXAMPLES_DIR / name for name in ('profile-credentials.json', 'experience-facts.json',
                                                  'answer.json', 'scan-first.json', 'scan-second.json', 'debrief.json')]
    return [str(path.relative_to(ROOT)) for path in required if not path.is_file()]


def local_python():
    for relative in ('dev/venv/bin/python', 'dev/venv/Scripts/python.exe'):
        path = DATA_DIR / relative
        if path.is_file():
            return path
    return None
