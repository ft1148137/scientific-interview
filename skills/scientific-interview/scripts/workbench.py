"""Resolve a linked source checkout without machine-specific paths in the skill."""
import os
from pathlib import Path
import sys
root=Path(os.environ.get('SCIENTIFIC_INTERVIEW_ROOT',os.environ.get('JOB_WORKBENCH_ROOT',Path(__file__).resolve().parents[3]))).expanduser()
if not (root/'job_workbench').is_dir():
    raise SystemExit('未找到项目，请设置 SCIENTIFIC_INTERVIEW_ROOT 为Scientific Interview源码目录。')
sys.path.insert(0,str(root))
from job_workbench.cli import main
raise SystemExit(main())
