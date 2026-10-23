"""Versioned interview recollections, kept separate from verified career facts."""
from copy import deepcopy
from datetime import date
from .contracts import require


def validate_debrief(state, data):
    for field in ("company", "role", "recollection"):
        require(isinstance(data.get(field), str) and data[field].strip(), f"面经需要 {field}")
    for field in ("date", "round", "outcome"):
        require(field not in data or isinstance(data[field], str), f"{field} 需要文本")
    if data.get("date"):
        try:
            date.fromisoformat(data["date"])
        except ValueError:
            require(False, "面试日期使用 YYYY-MM-DD；记不清时省略，不猜测")
    require(data.get("job_key") is None or isinstance(data["job_key"], str), "job_key 需要文本")
    require(not data.get("job_key") or data["job_key"] in state["jobs"], "关联岗位不存在；未收录的面试可以不关联岗位")
    require(type(data.get("deleted", False)) is bool, "deleted 需要布尔值")
    questions = data.get("questions", [])
    require(isinstance(questions, list), "questions 需要列表")
    for item in questions:
        require(isinstance(item, dict) and isinstance(item.get("question"), str) and item["question"].strip(), "面试问题需要 question")
        for field in ("answer", "feedback"):
            require(field not in item or isinstance(item[field], str), f"{field} 需要文本")
    evidence = [data["recollection"]] + [q.get(f, "") for q in questions for f in ("question", "answer", "feedback")]
    for field in ("strengths", "gaps"):
        require(isinstance(data.get(field, []), list), f"{field} 需要列表")
        for item in data.get(field, []):
            require(isinstance(item, dict) and all(isinstance(item.get(f), str) and item[f].strip() for f in ("point", "basis", "source")), "分析需要 point、basis 和 source")
            require(item["source"] in {"user_recollection", "interviewer_feedback", "ai_inference"}, "分析来源必须区分用户回忆、面试官反馈、AI 推断")
            sources = [q.get("feedback", "") for q in questions] if item["source"] == "interviewer_feedback" else evidence
            require(any(item["basis"] in text for text in sources), "分析依据须引用已记录的复述或问答原句；面试官反馈须引用 feedback")
    for field in ("next_steps", "resume_suggestions", "matching_notes"):
        require(isinstance(data.get(field, []), list) and all(isinstance(x, str) and x.strip() for x in data.get(field, [])), f"{field} 需要文本列表")


def validate_debrief_refs(state, record):
    refs = record.get("debrief_refs", [])
    require(isinstance(refs, list), "debrief_refs 需要列表")
    for ref in refs:
        require(isinstance(ref, dict) and isinstance(ref.get("id"), str), "复盘引用需要 id 和 version")
        versions = state.get("debriefs", {}).get(ref["id"], [])
        version = ref.get("version")
        require(type(version) is int and 1 <= version <= len(versions), "复盘引用版本不存在")
        item = versions[version - 1]
        require(item["confirmed"] and not item["data"].get("deleted"), "仅可引用已核对且未删除的复盘版本")
    require(not refs or isinstance(record.get("debrief_notes"), str) and record["debrief_notes"].strip(), "引用复盘时需用 debrief_notes 说明它如何影响本次修改或评分")


def debrief_context(state, target="", job_key=None):
    require(job_key is None or job_key in state["jobs"], "岗位不存在")
    candidates = []
    for key, versions in state.get("debriefs", {}).items():
        item = versions[-1]
        if item["confirmed"] and not item["data"].get("deleted"):
            candidates.append({"id": key, "version": item["version"], "updated_at": item["at"], "same_job": bool(job_key and item["data"].get("job_key") == job_key), "data": deepcopy(item["data"])})
    candidates.sort(key=lambda x: (x["same_job"], x["data"].get("date", ""), x["updated_at"]), reverse=True)
    return {"target": target, "job_key": job_key, "candidates": candidates,
            "guidance": "候选仅按同岗位和日期排序，不代表语义相关。AI 结合目标要求选择，引用 id/version 并说明影响；区分回忆、反馈和推断。一次表现不等于稳定能力；复盘不替代已确认经历，不自动改变申请状态或分数。"}
