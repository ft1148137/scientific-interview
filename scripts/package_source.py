"""Check Git publication candidates and package source without local runtime data.

Includes untracked, non-ignored source so it also works before the first commit.
This is a heuristic guard; new examples and images still need human review.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = {'.github', 'assets', 'contracts', 'docs', 'examples',
               'job_workbench', 'scripts', 'skills', 'slots', 'templates', 'tests'}
SOURCE_FILES = {'.gitignore', 'AGENTS.md', 'CHANGELOG.md', 'LICENSE',
                'README.md', 'README.zh-CN.md', 'pyproject.toml'}
PATTERNS = {
    'personal absolute path': re.compile(r'/Users/[\w. -]+/|/home/[\w.-]+/|[A-Za-z]:[\\/]Users[\\/][\w. -]+[\\/]'),
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'GitHub token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'API token': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b'),
    'AWS access key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
}


def candidates():
    # Avoid accidentally using a parent repository when running from a source ZIP.
    if not (ROOT / '.git').exists():
        raise ValueError('需要在本项目的 Git 仓库中运行；下载的源码可先 git init。')
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        cwd=ROOT, capture_output=True, check=True,
    )
    return sorted(set(result.stdout.decode('utf-8').strip('\0').split('\0')) - {''})


def checked_files():
    files = []
    for name in candidates():
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError(f'非法发布路径: {name}')
        if relative.parts[0] not in SOURCE_DIRS and name not in SOURCE_FILES:
            raise ValueError(f'未批准的发布目录或文件: {name}')
        if any(part in {'data', '.git', '.venv', '__pycache__', 'node_modules', 'build', 'dist'}
               or part.endswith('.egg-info') for part in relative.parts):
            raise ValueError(f'运行数据不能发布: {name}')
        if relative.name.startswith('.env') or relative.suffix.lower() in {'.pem', '.key', '.pyc'}:
            raise ValueError(f'敏感或生成文件不能发布: {name}')
        path = ROOT / relative
        if any(parent.is_symlink() for parent in [path, *path.parents] if parent != ROOT and ROOT in parent.parents):
            raise ValueError(f'发布文件不能通过符号链接读取: {name}')
        if not path.is_file():
            raise ValueError(f'发布候选文件不存在，请更新 Git 索引: {name}')
        payload = path.read_bytes()
        try:
            content = payload.decode('utf-8')
        except UnicodeDecodeError:
            if relative.suffix.lower() not in {'.jpg', '.png', '.ttf'}:
                raise ValueError(f'需要人工确认的二进制文件: {name}')
        else:
            for kind, pattern in PATTERNS.items():
                match = pattern.search(content)
                if match:
                    line = content.count('\n', 0, match.start()) + 1
                    raise ValueError(f'{name}:{line}: {kind}（不输出匹配内容）')
        files.append((name, payload))
    return files


def main():
    files = checked_files()
    version = re.search(r'^version = "([\d.]+)"', (ROOT / 'pyproject.toml').read_text(), re.M)[1]
    prefix = f'scientific-interview-{version}'
    output = ROOT / 'data' / 'releases'
    if not output.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError('发布目录不能通过符号链接指向项目外部')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'{prefix}-source.zip'
    manifest = output / f'{prefix}-source.sha256.json'
    if archive.is_symlink() or manifest.is_symlink():
        raise ValueError('发布产物不能为符号链接')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for name, payload in files:
            zipped.writestr(f'{prefix}/{name}', payload)
    manifest.write_text(json.dumps({
        'archive': archive.name,
        'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'files': {name: hashlib.sha256(payload).hexdigest() for name, payload in files},
    }, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'OK: {len(files)} source files; no data/ or Git metadata. Review examples/images before publication.')
    print(archive.relative_to(ROOT))
    print(manifest.relative_to(ROOT))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
