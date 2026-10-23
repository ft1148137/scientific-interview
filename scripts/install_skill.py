"""Install, inspect or repair a source-linked skill without overwriting user files."""
import argparse
import os
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from job_workbench.resources import SKILL_DIR, local_python, missing_resources


def install(destination, *, check=False, repair=False):
    missing = missing_resources()
    if missing:
        raise ValueError('源码资源不完整，请获取完整项目；缺少：' + ', '.join(missing))
    target = destination.expanduser().absolute() / 'scientific-interview'
    if target.is_symlink() and target.resolve() == SKILL_DIR:
        return target
    if check:
        raise ValueError('Skill 未安装或链接不指向当前项目。运行安装器；旧链接可加 --repair 修复。')
    if target.is_symlink():
        if not repair:
            raise ValueError('目标为其他或失效链接；确认改用当前项目后，加 --repair 修复。')
        # Build the replacement before switching so creation failures preserve the old link.
        staging = target.with_name('.scientific-interview-' + uuid4().hex)
        try:
            staging.symlink_to(SKILL_DIR, target_is_directory=True)
            staging.replace(target)
        finally:
            if staging.is_symlink():
                staging.unlink()
    elif target.exists():
        raise ValueError('目标是已有文件或目录，不会覆盖。可直接使用项目内 SKILL.md，或指定其他 --destination。')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(SKILL_DIR, target_is_directory=True)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path,
                        default=Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'skills',
                        help='Skill 父目录；隔离验证可使用 data/dev/skills')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='只读核对当前项目资源及安装链接')
    mode.add_argument('--repair', action='store_true', help='将其他或失效符号链接切换到当前源码，不覆盖文件/目录')
    args = parser.parse_args()
    try:
        target = install(args.destination, check=args.check, repair=args.repair)
    except (ValueError, OSError) as error:
        parser.exit(1, f'{error}\n若系统不允许符号链接，可在宿主中直接读取项目内 SKILL.md。\n')
    print('检查通过:' if args.check else '已安装:', target)
    print('源码:', SKILL_DIR)
    print('建议运行 Python:', local_python() or sys.executable)
    print('使用该 Python 运行 -m job_workbench doctor 检查依赖；安装链接不会替宿主切换 Python 环境。')


if __name__ == '__main__':
    main()
