"""Build a synthetic archive through the same validated workflows as real data."""
from .resources import EXAMPLES_DIR
from .store import read_json, WorkbenchError
from .contracts import require, jd_hash
from .jobs import save_search, ingest_scan, decide, classify_job, review_job, record_application
from .library import put_entry, select_resume
from .resumes import draft_resume, save_resume, export_resume
from .render import render_dashboard


def demo(store):
    state=store.init()
    require(not state["jobs"] or all(k.startswith("demo-company:") for k in state["jobs"]), "演示必须使用独立数据目录")
    def build(s):
        s["demo"] = True
        for collection, key, filename in [("profiles","personal","profile-credentials.json"),("experiences","knowledge-assistant","experience-facts.json"),("answers","why-role","answer.json")]:
            if key not in s[collection]:
                put_entry(s,collection,key,read_json(EXAMPLES_DIR/filename),True)
        save_search(s,"demo",{"keyword":"AI","city":"北京","sources":["demo-company"]})
        ingest_scan(s,read_json(EXAMPLES_DIR/"scan-first.json"))
        if s["jobs"]["demo-company:id:101"]["decision"] == "undecided":
            decide(s,"demo-company:id:101","shortlist","合成演示：希望继续了解")
        ingest_scan(s,read_json(EXAMPLES_DIR/"scan-second.json"))
        for job_key in s["jobs"]:
            if not s["jobs"][job_key].get("classification"):
                classify_job(s,job_key,"数据工程" if job_key.endswith(":102") else "软件研发","软件")
        key="demo-company:id:101"
        if "technical-first" not in s.get("debriefs", {}):
            put_entry(s,"debriefs","technical-first",{**read_json(EXAMPLES_DIR/"debrief.json"), "job_key":key},True)
        if not s["jobs"][key]["reviews"]:
            review_job(s,key,{"score":4,"jd_hash":jd_hash(s["jobs"][key]["current"]["jd"]),"reasons":["合成示例：已有检索助手开发与反馈改进经历"],"gaps":["尚未证明大规模在线服务经验"],"quotes":["维护检索与引用链路"],"experience_refs":[{"id":"knowledge-assistant","version":1}]})
        draft=draft_resume(s,"AI 应用工程师")
        draft["change_notes"]=["合成演示：保留检索助手经历，突出个人贡献与可验证结果。"]
        resume=save_resume(s,draft,True)
        select_resume(s,key,resume["id"])
        if not s["applications"]:
            record_application(s,key,"submitted",{"kind":"application","url":"https://jobs.example.com/jobs/101","observed_at":"2026-10-22T09:00:00+08:00","text":"合成演示：申请提交成功"},resume["id"])
        return resume["id"]
    resume_id=store.update(build)
    try:
        export=export_resume(store,resume_id)
    except WorkbenchError as exc:
        export={"note":str(exc)}
    return {"demo":"仅合成数据，不含真实用户资料", "resume":export,**render_dashboard(store)}

