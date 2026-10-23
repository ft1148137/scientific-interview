"""Protocol boundary validation, shared by imports and CLI operations."""
from datetime import datetime
import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from .store import WorkbenchError, digest

GATES = {"PASS", "WAIT_USER", "RETRY", "REJECT"}
CAPABILITIES = {"navigate", "observe", "click", "fill", "wait", "scroll", "screenshot"}


def require(condition, message):
    if not condition:
        raise WorkbenchError(message)


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9_.:-]{1,160}", value), "ID 必须为 1—160 个字母、数字或 ._:- 字符")
    return value


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(parsed.tzinfo is not None, "时间必须包含时区")
    except (AttributeError, ValueError, TypeError) as exc:
        raise WorkbenchError("时间必须是带时区的 ISO 8601 格式") from exc
    return value


def web_url(value, domains=None):
    require(isinstance(value, str), "URL 必须是字符串")
    u = urlsplit(value)
    require(u.scheme in {"https", "http"} and u.hostname and not u.username and not u.password, "仅接受无凭据的 HTTP(S) URL")
    if domains is not None:
        require(u.hostname.lower() in domains, f"域名不在网站插槽声明范围内: {u.hostname}")
    return value


def canonical_url(value):
    web_url(value)
    u = urlsplit(value)
    query = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"from", "source", "spm"}]
    return urlunsplit((u.scheme.lower(), u.netloc.lower(), u.path or "/", urlencode(sorted(query)), ""))


def job_key(source, external_id, url):
    identifier(source)
    if external_id is not None and str(external_id).strip():
        return source + ":id:" + str(external_id).strip()
    return source + ":url:" + digest(canonical_url(url))[:24]


def jd_hash(text):
    return digest(re.sub(r"\s+", " ", text or "").strip())


def evidence(value, domains=None, allow_missing_url=False):
    require(isinstance(value, dict), "需要证据对象")
    if not (allow_missing_url and value.get("url") is None and value.get("kind") == "user_supplied"):
        web_url(value.get("url"), domains)
    timestamp(value.get("observed_at"))
    require(isinstance(value.get("text"), str) and value["text"].strip(), "证据需要页面文本")
    require(value.get("kind") in {"page", "closed", "application", "user_supplied"}, "未知证据类型")
    return value


def manifest(data):
    require(isinstance(data, dict), "插槽声明必须是对象")
    identifier(data.get("id"))
    require(data.get("kind") in {"site", "browser"}, "未知插槽类型")
    require(data.get("protocol_version") == 1, "插槽协议版本不兼容")
    require(isinstance(data.get("version"), str) and data["version"], "缺少插槽版本")
    if data["kind"] == "site":
        require(isinstance(data.get("domains"), list) and data["domains"], "网站必须声明域名")
        for domain in data["domains"]:
            require(isinstance(domain, str) and re.fullmatch(r"[a-z0-9.-]+", domain), "域名需要精确主机名")
        require(set(data.get("requires", [])) <= CAPABILITIES, "网站请求了未知浏览器能力")
        web_url(data.get("entry_url"), data["domains"])
        if "shared_detail_url" in data:
            require(type(data["shared_detail_url"]) is bool, "shared_detail_url 必须为布尔值")
        if "company" in data:
            require(isinstance(data["company"], str) and data["company"].strip(), "企业声明不能为空")
        if "path_prefix" in data:
            prefix = data["path_prefix"]
            require(isinstance(prefix, str) and prefix.startswith("/") and not prefix.endswith("/") and not any(c in prefix for c in "?#%"), "租户路径必须为无查询参数的精确路径前缀")
            path = urlsplit(data["entry_url"]).path
            require(path == prefix or path.startswith(prefix + "/"), "入口超出声明租户路径")
    else:
        require(set(data.get("capabilities", [])) <= CAPABILITIES, "浏览器声明了未知能力")
    return data


def negotiate(site, browser):
    manifest(site); manifest(browser)
    require(site["kind"] == "site" and browser["kind"] == "browser", "插槽类型不匹配")
    missing = sorted(set(site.get("requires", [])) - set(browser.get("capabilities", [])))
    return {"gate": "REJECT" if missing else "PASS", "code": "MISSING_CAPABILITY" if missing else "READY", "missing": missing,
            "message": "浏览器缺少必要能力：" + ", ".join(missing) if missing else "能力声明兼容",
            "next_action": "连接支持这些能力的已注册 BrowserPort，检查成功后从断点继续。" if missing else "调用该 BrowserPort.connect 检查实际连接，再开始扫描。"}
