"""Loopback report server with a narrow, same-origin decision write endpoint."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
from threading import Lock
from .jobs import decide, has_application
from .render import render_dashboard
from .store import WorkbenchError


def report_server(store, port):
    token = secrets.token_urlsafe(32)
    write_lock = Lock()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(store.root / "report"), **kwargs)

        def respond(self, status, body):
            raw = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def same_host(self):
            return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

        def do_GET(self):
            if not self.same_host():
                return self.respond(403, {"error": "仅允许本机工作台访问"})
            if self.path == "/api/debriefs":
                state = store.read()
                return self.respond(200, {"revision": state["revision"], "debriefs": state.get("debriefs", {})})
            if self.path == "/api/session":
                return self.respond(200, {"token": token})
            return super().do_GET()

        def do_POST(self):
            origin = f"http://127.0.0.1:{self.server.server_port}"
            if not self.same_host() or self.headers.get("Origin") != origin or not secrets.compare_digest(self.headers.get("X-Workbench-Token", ""), token):
                return self.respond(403, {"error": "请从本机工作台页面保存标签"})
            if self.path != "/api/decision":
                return self.respond(404, {"error": "未知操作"})
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                return self.respond(415, {"error": "需要 JSON 请求"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 4096:
                    return self.respond(413, {"error": "请求大小无效"})
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict) or set(payload) != {"key", "decision", "revision"} or not isinstance(payload["key"], str) or not isinstance(payload["decision"], str) or type(payload["revision"]) is not int:
                    return self.respond(400, {"error": "标签请求格式无效"})
                with write_lock:
                    def update(state):
                        if payload["revision"] != state["revision"]:
                            raise WorkbenchError("页面已过期，请刷新后再保存标签")
                        if has_application(state, payload["key"]):
                            raise WorkbenchError("该岗位已投递，不能再设置投递前标签；请刷新页面查看申请状态。")
                        changed = payload["key"] not in state["jobs"] or state["jobs"][payload["key"]]["decision"] != payload["decision"]
                        if changed:
                            decide(state, payload["key"], payload["decision"])
                        job = state["jobs"][payload["key"]]
                        return {"revision": state["revision"] + int(changed), "decision": job["decision"], "history": job["decision_history"]}
                    result = store.update(update)
                    try:
                        render_dashboard(store)
                    except OSError:
                        result["warning"] = "标签已保存，但页面文件未能更新；请稍后重新生成工作台。"
                return self.respond(200, result)
            except WorkbenchError as exc:
                return self.respond(409, {"error": str(exc)})
            except (ValueError, TypeError, KeyError, UnicodeError):
                return self.respond(400, {"error": "标签请求格式无效"})
            except OSError:
                return self.respond(500, {"error": "保存未完成，请检查档案后重试"})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)
