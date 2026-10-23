"""Single-writer JSON store with revision checks and recoverable snapshots."""
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from .resources import ROOT, DATA_DIR


class WorkbenchError(ValueError):
    pass


def data_path(value):
    """Keep runtime writes inside the checkout's ignored data directory."""
    path = Path(value).expanduser()
    path = (path if path.is_absolute() else ROOT / path).resolve()
    if not path.is_relative_to(DATA_DIR):
        raise WorkbenchError("数据和输出必须位于项目 data/ 内；例如 --data data/main 或 --out data/main/drafts/resume.json。旧档案请完整迁移到 data/ 后再使用。")
    return path


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise WorkbenchError(f"无法读取 JSON: {path}: {exc}") from exc


def atomic_json(path, data):
    path = data_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def empty_state():
    return {"schema_version": 1, "revision": 0, "created_at": now(),
            **{k: {} for k in ("profiles", "experiences", "answers", "debriefs", "resumes", "jobs", "searches", "scans", "checkpoints", "interviews", "imports")},
            "events": [], "applications": []}


class Store:
    def __init__(self, root):
        self.root = data_path(root)
        self.path = data_path(self.root / "state.json")

    def read(self):
        if not self.path.exists():
            raise WorkbenchError("档案尚未创建，请先运行 init。")
        state = read_json(self.path)
        if state.get("schema_version") != 1:
            raise WorkbenchError("档案协议版本不兼容；请先迁移，不能覆盖。")
        return state

    @contextmanager
    def lock(self):
        self.root.mkdir(parents=True, exist_ok=True)
        lock = self.root / ".writer.lock"
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise WorkbenchError("另一个写入任务正在运行。确认其退出后才能移除 .writer.lock；不会强制覆盖。") from exc
        try:
            with os.fdopen(fd, "w") as stream:
                stream.write(str(os.getpid()))
            yield
        finally:
            lock.unlink(missing_ok=True)

    def init(self):
        with self.lock():
            if self.path.exists():
                return self.read()
            state = empty_state()
            atomic_json(self.path, state)
            return state

    def update(self, fn, expected_revision=None):
        with self.lock():
            state = self.read()
            if expected_revision is not None and state["revision"] != expected_revision:
                raise WorkbenchError("档案已被更新；重新读取后合并，不能用旧版本覆盖。")
            before = deepcopy(state)
            result = fn(state)
            if before != state:
                atomic_json(self.root / "backups" / f'{before["revision"]:08d}.json', before)
                state["revision"] += 1
                state["updated_at"] = now()
                atomic_json(self.path, state)
            return result

    def blob(self, content, suffix=".txt"):
        # Content-addressed immutable originals; never use user filenames as paths.
        key = hashlib.sha256(content).hexdigest()
        target = data_path(self.root / "originals" / (key + suffix))
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with target.open("xb") as stream:
                stream.write(content)
        return str(target.relative_to(self.root))


def add_event(state, kind, **data):
    event = {"id": len(state["events"]) + 1, "at": now(), "kind": kind, **data}
    state["events"].append(event)
    return event


def current(collection, key):
    entries = collection.get(key, [])
    return entries[-1] if entries else None


def append_version(collection, key, data, confirmed=False):
    versions = collection.setdefault(key, [])
    item = {"version": len(versions) + 1, "at": now(), "confirmed": confirmed, "data": deepcopy(data)}
    versions.append(item)
    return item
