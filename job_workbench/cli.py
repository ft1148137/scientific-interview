import argparse
import errno
import json
import os
from pathlib import Path
import sys
from .store import Store, WorkbenchError, read_json, atomic_json, digest, now, data_path
from .contracts import require, negotiate
from .registry import registry
from .resources import ROOT, DATA_DIR, missing_resources, local_python
from .demo import demo
from .jobs import ingest_scan, save_search, decide, review_job, record_application, classify_job, set_activity, import_review
from .library import put_entry, restore_entry, find_answer, interview, select_resume, COLLECTIONS
from .resumes import import_resume, draft_resume, save_resume, export_resume, source_updates
from .render import render_dashboard
from .server import report_server
from .debriefs import debrief_context


def parser():
    p = argparse.ArgumentParser(description="Scientific Interview：本地档案与可扩展 Skill")
    p.add_argument("--data", default=os.environ.get("SCIENTIFIC_INTERVIEW_DATA", os.environ.get("JOB_WORKBENCH_DATA", str(DATA_DIR/"main"))), help="项目 data/ 内的档案目录，默认 data/main；相对路径以项目根目录为基准")
    p.add_argument("--expected-revision", type=int)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("init"); sub.add_parser("status"); sub.add_parser("doctor"); sub.add_parser("demo")
    c=sub.add_parser("ingest"); c.add_argument("file")
    c=sub.add_parser("search-save"); c.add_argument("id"); c.add_argument("file")
    c=sub.add_parser("library-put"); c.add_argument("collection",choices=sorted(COLLECTIONS)); c.add_argument("id"); c.add_argument("file"); c.add_argument("--confirmed",action="store_true"); c.add_argument("--expected-version",type=int)
    c=sub.add_parser("library-restore"); c.add_argument("collection",choices=sorted(COLLECTIONS)); c.add_argument("id"); c.add_argument("version",type=int)
    c=sub.add_parser("answer"); c.add_argument("question"); c.add_argument("--context",default=""); c.add_argument("--all-candidates",action="store_true",help="向 AI 提供全部已确认回答，由 AI 按意图判断，不表示均可复用")
    c=sub.add_parser("interview"); c.add_argument("id"); c.add_argument("--target"); c.add_argument("--skip",action="append"); c.add_argument("--industry",help="可选行业 ID，见 references/industries/index.md"); c.add_argument("--segment",choices=["campus","experienced"],help="校招/社招，按需选择")
    c=sub.add_parser("debrief-context"); c.add_argument("--target",default=""); c.add_argument("--key")
    c=sub.add_parser("resume-import", help="导入 PDF 简历原件"); c.add_argument("file", help="PDF 文件路径")
    c=sub.add_parser("resume-draft"); c.add_argument("--target",required=True); c.add_argument("--experience",action="append"); c.add_argument("--parent",help="已保存的 resume-… 父版本 ID"); c.add_argument("--source-import",help="resume-import 返回的原件 ID，首次改写旧简历时使用"); c.add_argument("--out",required=True)
    c.add_argument("--rebuild",action="store_true",help="明确从最新经历重建，不沿用父稿文案与经历取舍")
    c=sub.add_parser("resume-save"); c.add_argument("file"); c.add_argument("--confirmed",action="store_true")
    c=sub.add_parser("resume-export"); c.add_argument("id"); c.add_argument("--out")
    c=sub.add_parser("resume-select"); c.add_argument("key"); c.add_argument("id")
    c=sub.add_parser("decide"); c.add_argument("key"); c.add_argument("decision",choices=["shortlist","excluded","undecided"]); c.add_argument("--note",default="")
    c=sub.add_parser("job-activity"); c.add_argument("key"); c.add_argument("mode",choices=["inactive","auto"]); c.add_argument("--note",default="")
    c=sub.add_parser("job-classify"); c.add_argument("key"); c.add_argument("--direction"); c.add_argument("--industry")
    c=sub.add_parser("review-import"); c.add_argument("key"); c.add_argument("file")
    c=sub.add_parser("review"); c.add_argument("key"); c.add_argument("file")
    c=sub.add_parser("application"); c.add_argument("key"); c.add_argument("status"); c.add_argument("evidence"); c.add_argument("--resume")
    c=sub.add_parser("add-jd"); c.add_argument("file"); c.add_argument("--title",required=True); c.add_argument("--company",required=True); c.add_argument("--url",required=True); c.add_argument("--location"); c.add_argument("--complete",action="store_true")
    c=sub.add_parser("render"); c.add_argument("--out",metavar="HTML_FILE",help="项目 data/ 内的 HTML 文件路径，例如 data/main/report/index.html；不是目录"); c.add_argument("--share",action="store_true",help="生成独立的岗位分享副本，排除个人资料、评语、历史、简历和申请记录；原岗位文本仍须人工检查")
    c=sub.add_parser("serve"); c.add_argument("--port",type=int,default=8877)
    c=sub.add_parser("show"); c.add_argument("collection",nargs="?"); c.add_argument("id",nargs="?")
    return p


def doctor():
    missing = missing_resources()
    require(not missing, "源码资源不完整，请重新获取完整项目；缺少：" + ", ".join(missing))
    slots=registry()
    pairs=[{"site":s["id"],"browser":b["id"],**negotiate(s,b)} for s in slots.values() if s["kind"]=="site" for b in slots.values() if b["kind"]=="browser"]
    import importlib.util
    browsers=[{"id":b["id"],"connection_check": b.get("connection_hint") or ("在 Codex 对话连接 Chrome 插件；缺插件时由用户连接后继续。" if b["id"]=="codex-chrome" else "按此 BrowserPort 的 connect 文档检查连接；声明兼容不代表实际连接通过。"),"capabilities":b["capabilities"]} for b in slots.values() if b["kind"]=="browser"]
    return {"python":sys.version.split()[0],"python_executable":sys.executable,"recommended_python":str(local_python()) if local_python() else None,"root":str(ROOT),"slots":pairs,"resume_dependencies":{name:importlib.util.find_spec(name) is not None for name in ["docx","pypdf","reportlab"]},"browser_checks":browsers,"browser":"能力声明已检查；实际连接方式见各 browser_checks，命令行不会替代宿主访问浏览器。"}



def run(args):
    if args.command=="doctor":return doctor()
    store=Store(data_path(args.data))
    if getattr(args, "out", None) is not None:
        args.out = str(data_path(args.out))
    update=lambda fn:store.update(fn,args.expected_revision)
    cmd=args.command
    if cmd=="init":return {"data":str(store.root),"revision":store.init()["revision"]}
    if cmd=="demo":return demo(store)
    if cmd=="status":
        s=store.read();return {"data":str(store.root),"revision":s["revision"],**{k:len(s.get(k,{})) for k in ["jobs","experiences","answers","debriefs","resumes","scans","applications"]}}
    if cmd=="show":
        s=store.read();d=s.get(args.collection) if args.collection else s
        if args.id:require(isinstance(d,dict) and args.id in d,"记录不存在");d=d[args.id]
        return d
    if cmd=="ingest":return update(lambda s:ingest_scan(s,read_json(args.file)))
    if cmd=="search-save":return update(lambda s:save_search(s,args.id,read_json(args.file)))
    if cmd in {"library-put", "library-restore"}:
        result = update(lambda s: put_entry(s,args.collection,args.id,read_json(args.file),args.confirmed,args.expected_version)) if cmd == "library-put" else update(lambda s: restore_entry(s,args.collection,args.id,args.version))
        if args.collection == "debriefs":
            try:
                return {**result, "report": render_dashboard(store)}
            except OSError:
                return {**result, "warning": "复盘已保存，HTML 更新失败；稍后运行 render。"}
        return result
    if cmd=="debrief-context":return debrief_context(store.read(),args.target,args.key)
    if cmd=="answer":return find_answer(store.read(),args.question,args.context,args.all_candidates)
    if cmd=="interview":return update(lambda s:interview(s,args.id,args.target,args.skip,args.industry,args.segment))
    if cmd=="resume-import":return import_resume(store,args.file)
    if cmd=="resume-draft":
        s=store.read();d=draft_resume(s,args.target,args.experience,args.parent,args.source_import,args.rebuild);atomic_json(args.out,d)
        notes=[{"experience_id":e["experience_id"],"pending_notes":s["experiences"][e["experience_id"]][e["experience_version"]-1]["data"]["pending_notes"]} for e in d["entries"] if s["experiences"][e["experience_id"]][e["experience_version"]-1]["data"].get("pending_notes")]
        return {"draft":str(Path(args.out).resolve()),"source_updates":source_updates(s,d),"pending_notes":notes,"debrief_context":debrief_context(s,args.target),"next":"核对文案和事实限定后 resume-save --confirmed；待补事项留在私人档案。续改父稿保留原文与原引用，source_updates 提示新资料可另行合并；--rebuild 会按最新资料重建。"}
    if cmd=="resume-save":return update(lambda s:save_resume(s,read_json(args.file),args.confirmed))
    if cmd=="resume-export":return export_resume(store,args.id,args.out)
    if cmd=="resume-select":return update(lambda s:select_resume(s,args.key,args.id))
    if cmd=="decide":return update(lambda s:decide(s,args.key,args.decision,args.note))
    if cmd=="job-activity":return update(lambda s:set_activity(s,args.key,args.mode,args.note))
    if cmd=="job-classify":return update(lambda s:classify_job(s,args.key,args.direction,args.industry))
    if cmd=="review-import":return update(lambda s:import_review(s,args.key,read_json(args.file)))
    if cmd=="review":return update(lambda s:review_job(s,args.key,read_json(args.file)))
    if cmd=="application":return update(lambda s:record_application(s,args.key,args.status,read_json(args.evidence),args.resume))
    if cmd=="add-jd":
        text=Path(args.file).read_text(encoding="utf-8");at=now()
        scan={"protocol_version":1,"id":"manual-"+digest([args.url,text,args.complete,at])[:20],"source":"manual","slot_version":"1.0.0","browser_id":"fixture","query":{},"observed_at":at,"gate":"PASS","coverage":"partial","records":[{"url":args.url,"company":args.company,"title":args.title,"location":args.location,"jd":text,"jd_complete":args.complete,"status":"unknown","observed_at":at,"evidence":{"url":args.url,"observed_at":at,"text":text,"kind":"user_supplied"}}]}
        return update(lambda s:ingest_scan(s,scan))
    if cmd=="render":return render_dashboard(store,args.out,share=args.share)
    if cmd=="serve":
        render_dashboard(store)
        server=report_server(store,args.port)
        print(f"http://127.0.0.1:{server.server_port}/index.html",flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
        return {"stopped":True}
    raise WorkbenchError("未知命令")


def main():
    args=parser().parse_args()
    try:
        result=run(args)
        print(json.dumps(result if result is not None else {"ok":True},ensure_ascii=False,indent=2))
    except FileNotFoundError as exc:
        print(json.dumps({"ok":False,"error":str(exc),"next_action":"找不到文件，请核对输入文件的绝对路径；不要把示例 /path/to 路径直接用于真实任务。"},ensure_ascii=False),file=sys.stderr)
        return 2
    except OSError as exc:
        hint="本机端口已占用，可改用 serve --port 8878；不要终止未知服务。" if exc.errno==errno.EADDRINUSE else "检查文件路径、目录写权限和剩余磁盘空间后重试。"
        print(json.dumps({"ok":False,"error":str(exc),"next_action":hint},ensure_ascii=False),file=sys.stderr)
        return 2
    except (WorkbenchError,KeyError,TypeError,ValueError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)},ensure_ascii=False),file=sys.stderr)
        return 2
    return 0
