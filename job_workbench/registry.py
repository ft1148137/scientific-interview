from pathlib import Path
from .store import read_json, WorkbenchError
from .contracts import manifest, require

from .resources import ROOT


def registry(root=ROOT):
    path = Path(root) / "slots" / "registry.json"
    data = read_json(path)
    result = {}
    for item in data["slots"]:
        location = (Path(root) / item).resolve()
        require(location.is_relative_to(Path(root).resolve()), "插槽路径越界")
        entry = manifest(read_json(location))
        require(entry["id"] not in result, "插槽 ID 冲突，需要显式选择")
        result[entry["id"]] = entry
    return result


def site_config(source, root=ROOT):
    entry = registry(root).get(source)
    require(entry and entry["kind"] == "site", f"未注册网站插槽: {source}")
    return entry
