# Repository rules

- Put all business data and runtime artifacts under this checkout's `data/` directory. Use `data/main/` for the default archive, `data/demo/` for demos, `data/tmp/` for temporary tests, and `data/dev/` for logs, scratch scripts, and development captures. Never force-add data to Git.
- Keep `examples/` and documentation assets limited to intentionally published synthetic fixtures. Do not store user resumes, interview recollections, application records, credentials, or raw website captures in source directories.
- Preserve existing archives when changing paths. Stop the corresponding writers, move the complete directory without overwriting an existing destination, verify contents, and restart using the new path. Do not silently initialize an empty replacement for an existing archive.
- Keep `README.md` (English), `README.zh-CN.md` (Chinese), `skills/scientific-interview/SKILL.md`, its affected references, `CHANGELOG.md`, `pyproject.toml`, and `job_workbench/__init__.py` consistent with shipped behavior. Removed features must also be removed from active Skill instructions.
- For storage or workflow changes, run the relevant tests and `python scripts/check_project.py`. This check also rejects version drift and tracked data files. Use synthetic data for verification.
