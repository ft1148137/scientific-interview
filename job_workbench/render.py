from copy import deepcopy
import json
from pathlib import Path
import shutil
from .contracts import jd_hash, require
from .resources import TEMPLATES_DIR
from .store import now, data_path
from .resumes import resume_diff


def render_dashboard(store, output=None, share=False):
    state = store.read()
    target = data_path(output if output else store.root / ("share" if share else "report") / "index.html")
    require(not target.is_dir(), "--out 需要 HTML 文件路径，例如 report/index.html；当前传入的是目录。")
    require(not share or target.resolve() != (store.root / "report" / "index.html").resolve(), "分享副本不能覆盖私人工作台；请选择新路径或使用默认 share/index.html")
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = deepcopy(state)
    payload["profile"] = deepcopy(state.get("profiles", {}).get("personal", [None])[-1])
    payload.setdefault("debriefs", {})
    for job in payload["jobs"].values():
        # Snapshots are appended only for material job changes, not repeated observations.
        job["last_changed_at"] = (job.get("snapshots") or [{}])[-1].get("observed_at") or job.get("first_seen") or job["current"].get("observed_at")
    # Only include data the private UI actually presents. Sharing uses a separate whitelist below.
    for field in ("imports", "checkpoints", "interviews", "events", "profiles", "plans"):
        payload.pop(field, None)
    for scan in payload["scans"].values():
        scan.pop("checkpoint", None)
    payload["report_mode"] = "share" if share else "private"
    if share:
        public_jobs = {}
        for key, job in payload["jobs"].items():
            current = {field: job["current"].get(field) for field in ("key", "source", "title", "company", "location", "url", "jd", "jd_complete", "status", "observed_at")}
            public_jobs[key] = {"current": current, "snapshots": [], "reviews": [], "decision": "undecided", "decision_history": [], "selected_resume": None, "verification": job["verification"], "last_changed_at": job["last_changed_at"]}
        payload = {"schema_version": 1, "revision": state["revision"], "report_mode": "share", "demo": state.get("demo", False), "jobs": public_jobs,
                   "experiences": {}, "answers": {}, "debriefs": {}, "resumes": {}, "scans": {}, "searches": {}, "applications": []}
    for job in payload["jobs"].values():
        job["jd_hash"] = jd_hash(job["current"].get("jd"))
        latest = (job["reviews"] or job.get("imported_reviews", []) or [None])[-1]
        stale_refs = latest and any(state["experiences"].get(ref["id"], [{}])[-1].get("version") != ref["version"] for ref in latest.get("experience_refs", []))
        stale_debriefs = latest and any(state.get("debriefs", {}).get(ref["id"], [{}])[-1].get("version") != ref["version"] for ref in latest.get("debrief_refs", []))
        job["review_stale"] = bool(latest and (latest["jd_hash"] != job["jd_hash"] or stale_refs or stale_debriefs))
    if not share:
        payload["resume_imports"] = []
        for item in state.get("imports", {}).values():
            source = (store.root / item["original"]).resolve()
            if source.suffix.lower() != ".pdf" or not source.is_relative_to((store.root / "originals").resolve()) or not source.is_file():
                continue
            dest = data_path(target.parent / "resume-originals" / source.name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
            payload["resume_imports"].append({"id": item["id"], "filename": item.get("filename") or ("导入简历 " + item["id"][:8] + source.suffix), "at": item["at"], "file": str(dest.relative_to(target.parent))})
    for key, resume in payload["resumes"].items():
        resume["diff"] = resume_diff(state, resume)
        source = store.root / "exports" / key
        resume["files"] = {}
        for filename in ("resume.pdf", "resume.docx", "resume.md", "changes.md"):
            if (source / filename).is_file():
                dest = data_path(target.parent / "resumes" / key / filename)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source / filename, dest)
                resume["files"][filename] = str(dest.relative_to(target.parent))
    serialized = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = (TEMPLATES_DIR / "dashboard.html").read_text(encoding="utf-8")
    statistics = "\n".join((TEMPLATES_DIR / name).read_text(encoding="utf-8") for name in ("statistics.js", "statistics-view.js"))
    target.write_text(template.replace("__STATISTICS_SCRIPT__", statistics).replace("__WORKBENCH_DATA__", serialized).replace("__GENERATED_AT__", now()), encoding="utf-8")
    return {"output": str(target.resolve()), "jobs": len(state["jobs"]), "revision": state["revision"]}
