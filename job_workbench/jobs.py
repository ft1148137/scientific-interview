"""Only this module turns observations into job history; user choices are separate."""
from copy import deepcopy
from urllib.parse import urlsplit
from .debriefs import validate_debrief_refs
from datetime import datetime
from .contracts import require, identifier, timestamp, evidence, web_url, job_key, jd_hash, GATES
from .registry import site_config, registry
from .store import add_event, append_version, current, digest, now, WorkbenchError


def save_search(state, key, query):
    identifier(key)
    require(isinstance(query, dict), "搜索条件必须是对象")
    require(set(query) <= {"keyword", "city", "direction", "sources"}, "未知搜索条件")
    for k in ("keyword", "city", "direction"):
        require(query.get(k) is None or isinstance(query[k], str), "搜索条件需要文本")
    if "sources" in query:
        require(isinstance(query["sources"], list), "sources 必须是数组")
        for source in query["sources"]:
            site_config(source)
    old = current(state["searches"], key)
    if old and old["data"] == query:
        return old
    return append_version(state["searches"], key, query, True)


def normalize_job(raw, source, domains):
    require(isinstance(raw, dict), "岗位必须是对象")
    web_url(raw.get("url"), domains)
    require(isinstance(raw.get("title"), str) and raw["title"].strip(), "岗位缺少标题")
    require(isinstance(raw.get("company"), str) and raw["company"].strip(), "岗位缺少企业")
    require(raw.get("external_id") is None or (isinstance(raw["external_id"], (str, int)) and not isinstance(raw["external_id"], bool) and len(str(raw["external_id"])) <= 200), "岗位 ID 格式无效")
    require(raw.get("location") is None or isinstance(raw["location"], str), "地点必须为文本或 null")
    require(type(raw.get("jd_complete")) is bool, "必须显式声明 JD 完整性")
    ev = evidence(raw.get("evidence"), domains)
    require(ev["url"] == raw["url"], "岗位证据 URL 与详情 URL 不一致")
    timestamp(raw.get("observed_at"))
    status = raw.get("status", "unknown")
    require(status in {"open", "closed", "unknown"}, "未知岗位状态")
    jd = raw.get("jd")
    require(jd is None or isinstance(jd, str), "JD 必须为文本或 null")
    if status == "closed":
        require(ev["kind"] == "closed" and raw.get("closed_reason") and raw["closed_reason"] in ev["text"], "下线必须包含明确停招原文证据")
    key = job_key(source, raw.get("external_id"), raw["url"])
    return {"key": key, "source": source, "external_id": raw.get("external_id"),
            "identity_confidence": "high" if raw.get("external_id") else "url",
            "company": raw["company"].strip(), "title": raw["title"].strip(), "url": raw["url"],
            "jd": jd.strip() if jd else None, "jd_complete": bool(jd and raw.get("jd_complete") is True),
            "location": raw.get("location"), "status": status, "observed_at": raw["observed_at"],
            "closed_reason": raw.get("closed_reason"), "evidence": deepcopy(ev),
            "jd_observed_at": raw["observed_at"] if jd else None, "jd_evidence": deepcopy(ev) if jd else None}


def ingest_scan(state, scan):
    require(isinstance(scan, dict) and scan.get("protocol_version") == 1, "扫描协议不兼容")
    scan_id = identifier(scan.get("id"))
    source = scan.get("source")
    site = site_config(source)
    require(scan.get("slot_version") == site["version"], "网站版本不匹配，请重新核验")
    browser = scan.get("browser_id")
    require(browser == "fixture" or registry().get(browser, {}).get("kind") == "browser", "未知浏览器记录来源")
    require(browser != "fixture" or site.get("fixture_only") or site.get("user_supplied"), "真实网站不能用 fixture 浏览器来源")
    require(scan.get("gate") in GATES, "扫描缺少门禁结果")
    require(scan.get("coverage") in {"complete", "partial", "unknown"}, "扫描覆盖状态无效")
    timestamp(scan.get("observed_at"))
    query = scan.get("query", {})
    require(isinstance(query, dict), "搜索条件需要对象")
    require(isinstance(scan.get("records"), list), "扫描记录必须是数组")
    fingerprint = digest(scan)
    if scan_id in state["scans"]:
        require(state["scans"][scan_id]["fingerprint"] == fingerprint, "同一扫描 ID 的内容发生冲突")
        return {"id": scan_id, "idempotent": True, "changes": []}
    if scan["gate"] != "PASS":
        require(scan["coverage"] != "complete", "未通过门禁的扫描不能标记全量完成")
    changes, rejected, seen = [], [], set()
    condition_hash = digest({"source": source, "query": query})
    for raw in scan["records"]:
        try:
            if site.get("user_supplied"):
                require(raw.get("evidence", {}).get("kind") == "user_supplied" and raw.get("status") == "unknown", "粘贴 JD 必须标记用户提供，招聘状态保持未知")
            item = normalize_job(raw, source, None if site.get("user_supplied") else site["domains"])
            if site.get("shared_detail_url"):
                require(item["external_id"], "共用页面 URL 的岗位必须提供稳定 ID")
            if site.get("company"):
                require(item["company"] == site["company"], "岗位企业与插槽声明不一致")
            if site.get("path_prefix"):
                prefix = site["path_prefix"]
                path = urlsplit(item["url"]).path
                require("%" not in path and not any(part in {".", ".."} for part in path.split("/")), "租户岗位路径不能包含编码或路径跳转")
                require(path == prefix or path.startswith(prefix + "/"), "岗位 URL 超出声明租户路径")
                require(item["external_id"], "租户岗位必须提供稳定岗位 ID")
        except WorkbenchError as exc:
            rejected.append({"record": deepcopy(raw), "reason": str(exc)})
            continue
        key = item["key"]
        if key in seen:
            continue
        old = state["jobs"].get(key)
        if old and datetime.fromisoformat(item["observed_at"].replace("Z", "+00:00")) < datetime.fromisoformat(old["current"]["observed_at"].replace("Z", "+00:00")):
            rejected.append({"record": deepcopy(raw), "reason": "旧观测不能覆盖新观测"})
            continue
        seen.add(key)
        if old:
            previous = old["current"]
            # Sparse observations preserve prior known values, without pretending they were reverified.
            for field in ("jd", "location", "external_id"):
                if not item.get(field):
                    item[field] = previous.get(field)
                    if field == "jd":
                        item["jd_complete"] = previous.get("jd_complete", False)
                        item["jd_observed_at"] = previous.get("jd_observed_at")
                        item["jd_evidence"] = previous.get("jd_evidence")
            if item["status"] == "unknown":
                item["status"] = previous["status"]
            meaningful = any(item.get(f) != previous.get(f) for f in ("title", "company", "location", "status", "jd_complete")) or jd_hash(item["jd"]) != jd_hash(previous["jd"])
            if meaningful:
                if jd_hash(item["jd"]) != jd_hash(previous["jd"]):
                    changes.append({"type": "jd_changed", "key": key, "before": previous["jd"], "after": item["jd"]})
                for field in ("title", "location", "status", "jd_complete"):
                    if item.get(field) != previous.get(field):
                        changes.append({"type": "closed" if field == "status" and item[field] == "closed" else "reopened" if field == "status" and item[field] == "open" else "field_changed", "key": key, "field": field, "before": previous.get(field), "after": item.get(field)})
                old["snapshots"].append(deepcopy(item))
            old["current"] = item
            old["last_attempt_at"] = scan["observed_at"]
            old["verification"] = "verified" if raw.get("jd") or raw.get("status") == "closed" else "needs_recheck"
        else:
            state["jobs"][key] = {"current": item, "snapshots": [deepcopy(item)], "first_seen": scan["observed_at"], "last_attempt_at": scan["observed_at"], "verification": "verified" if item["jd"] else "needs_jd", "decision": "undecided", "decision_history": [], "reviews": [], "selected_resume": None}
            changes.append({"type": "new", "key": key, "after": item["title"]})
        scope = {}
        if query.get("city"):
            location = item.get("location")
            scope["city"] = "unknown" if not location else "pass" if query["city"].casefold() in location.casefold() else "fail"
        if query.get("direction"):
            scope["direction"] = "unknown"  # Requires semantic review, never infer from a missing field.
        state["jobs"][key].setdefault("search_scopes", {})[condition_hash] = {"query": deepcopy(query), "checks": scope}
    # A missing list entry is never evidence of closure. Only compare identical search scopes.
    seen_urls = scan.get("seen_urls", [])
    require(isinstance(seen_urls, list) and all(isinstance(u, str) for u in seen_urls), "seen_urls 必须为 URL 数组")
    seen_ids = scan.get("seen_ids", [])
    require(isinstance(seen_ids, list) and all(isinstance(i, str) and i for i in seen_ids), "seen_ids 必须为非空岗位 ID 字符串数组")
    seen.update(k for k, j in state["jobs"].items() if j["current"]["source"] == source and
                (str(j["current"].get("external_id")) in seen_ids or
                 (not site.get("shared_detail_url") and j["current"]["url"] in seen_urls)))
    previous_scans = [s for s in state["scans"].values() if s["condition_hash"] == condition_hash and s["gate"] == "PASS" and s["coverage"] == "complete"]
    if scan["coverage"] == "complete" and scan["gate"] == "PASS" and previous_scans:
        for key in set(previous_scans[-1]["seen"]) - seen:
            state["jobs"][key]["verification"] = "needs_recheck"
            changes.append({"type": "needs_recheck", "key": key, "after": "本次列表未发现，尚不能判定下线"})
    scoped = {k for k, j in state["jobs"].items() if condition_hash in j.get("search_scopes", {})}
    record = {k: deepcopy(scan.get(k)) for k in ("id", "source", "slot_version", "browser_id", "query", "gate", "coverage", "observed_at", "checkpoint", "message", "seen_urls", "seen_ids", "rejected_refs", "code", "retryAfter", "retry_attempts", "next_action")}
    record.update(fingerprint=fingerprint, condition_hash=condition_hash, seen=sorted(seen), changes=changes, rejected=rejected,
                  scope_summary={"observed_keys": sorted(seen), "known_keys": sorted(scoped), "unobserved_keys": sorted(scoped - seen)})
    state["scans"][scan_id] = record
    if scan.get("checkpoint"):
        cp = scan["checkpoint"]
        require(isinstance(cp, dict) and cp.get("protocol_version") == 1, "断点版本无效")
        require(not ({"password", "cookies", "token", "element_ref"} & set(cp)), "断点不得含凭据或临时元素句柄")
        state["checkpoints"][scan_id] = deepcopy(cp)
    add_event(state, "scan", scan_id=scan_id, changes=len(changes), rejected=len(rejected))
    return {"id": scan_id, "changes": changes, "rejected": rejected, "gate": scan["gate"]}


def has_application(state, key):
    cutoff = datetime.fromisoformat(now().replace("Z", "+00:00"))
    return any(a["key"] == key and a["status"] in {"submitted", "in_review", "interview", "offer", "rejected", "withdrawn"}
               and datetime.fromisoformat(a["evidence"]["observed_at"].replace("Z", "+00:00")) <= cutoff
               for a in state["applications"])


def decide(state, key, decision, note=""):
    require(key in state["jobs"], "岗位不存在")
    require(decision in {"undecided", "shortlist", "excluded"}, "未知人工决定")
    job = state["jobs"][key]
    job["decision"] = decision
    job["decision_history"].append({"decision": decision, "note": note, "at": now()})
    add_event(state, "decision", key=key, decision=decision)


def classify_job(state, key, direction=None, industry=None):
    require(key in state["jobs"], "岗位不存在")
    require(direction is not None or industry is not None, "至少提供 direction 或 industry；空文本可清除分类")
    job = state["jobs"][key]
    labels = dict(job.get("classification", {}))
    for field, value in (("direction", direction), ("industry", industry)):
        if value is not None:
            require(isinstance(value, str) and len(value) <= 100, "分类应为不超过 100 字的文本")
            labels[field] = value.strip()
    job["classification"] = labels
    job.setdefault("classification_history", []).append({**labels, "at": now()})
    add_event(state, "job_classified", key=key, **labels)
    return labels


def review_job(state, key, review):
    require(key in state["jobs"], "岗位不存在")
    job = state["jobs"][key]
    data = job["current"]
    require(data.get("jd") and data.get("jd_complete"), "缺完整 JD，保持未评分。请在官网补读职责与要求，或让用户提供完整原文后重新录入；不要靠摘要猜分。")
    require(review.get("jd_hash") == jd_hash(data["jd"]), "JD 已变更，请重新分析")
    require(type(review.get("score")) is int and 1 <= review["score"] <= 5, "匹配分应为 1—5 的整数")
    require(isinstance(review.get("reasons"), list) and review["reasons"] and all(isinstance(x, str) and x.strip() for x in review["reasons"]) and isinstance(review.get("gaps"), list) and all(isinstance(x, str) for x in review["gaps"]), "分析需包括理由和差距文本数组")
    require(isinstance(review.get("quotes"), list) and review["quotes"] and all(isinstance(q, str) and q.strip() and q in data["jd"] for q in review["quotes"]), "岗位引文必须来自当前 JD")
    refs = review.get("experience_refs", [])
    require(refs, "评分需要确认过的经历依据")
    for ref in refs:
        history = state["experiences"].get(ref["id"], [])
        require(type(ref.get("version")) is int and 1 <= ref["version"] <= len(history) and history[ref["version"] - 1]["confirmed"], "经历引用不存在或未经确认")
    if "requirements" in review:
        require(isinstance(review["requirements"], list), "逐项匹配 requirements 应为数组")
        for item in review["requirements"]:
            require(isinstance(item, dict) and item.get("quote") in review["quotes"], "逐项要求应引用已核验的 JD 原句")
            require(isinstance(item.get("assessment"), str) and item["assessment"].strip() and isinstance(item.get("gap", ""), str), "每项匹配需说明判断与差距")
            require(isinstance(item.get("experience_refs"), list) and all(ref in refs for ref in item["experience_refs"]), "逐项经历应引用本次分析的已确认版本")
    validate_debrief_refs(state, review)
    saved = {**deepcopy(review), "at": now()}
    job["reviews"].append(saved)
    add_event(state, "review", key=key)
    return saved


def record_application(state, key, status, ev, resume_id=None):
    require(key in state["jobs"], "岗位不存在")
    require(status in {"submitted", "in_review", "interview", "offer", "rejected", "withdrawn", "unknown"}, "未知申请状态")
    evidence(ev)
    require(ev["kind"] == "application", "申请更新需要申请状态证据")
    selected = resume_id or state["jobs"][key].get("selected_resume")
    require(selected is None or selected in state["resumes"], "简历版本不存在")
    entry = {"key": key, "status": status, "evidence": deepcopy(ev), "resume_id": selected, "at": now()}
    state["applications"].append(entry)
    add_event(state, "application_changed", **entry)
    return entry
