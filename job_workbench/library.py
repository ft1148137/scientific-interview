"""Confirmed experience and answer histories; guided interviews share these records."""
from copy import deepcopy
from difflib import SequenceMatcher
import re
from .contracts import require, identifier
from .store import append_version, current, digest, add_event, now
from .resources import INDUSTRIES_DIR
from .debriefs import validate_debrief

COLLECTIONS = {"profiles", "experiences", "answers", "debriefs"}
EXPERIENCE_FIELDS = ("context", "responsibility", "actions", "result", "evidence")


def text_fields(data, fields):
    for field in fields:
        require(field not in data or isinstance(data[field], str), f"{field} 需要文本；未知可省略")


def validate_facts(data):
    if "pending_notes" in data:
        require(isinstance(data["pending_notes"], list) and all(isinstance(x, str) and x.strip() for x in data["pending_notes"]), "pending_notes 需要待补事项文本列表")
    if "facts" not in data:
        return
    facts = data["facts"]
    require(isinstance(facts, dict), "facts 需要对象")
    text_fields(facts, ("stage", "responsibility_boundary"))
    for field in ("metrics", "evidence_refs"):
        require(isinstance(facts.get(field, []), list), f"{field} 需要列表")
    for metric in facts.get("metrics", []):
        require(isinstance(metric, dict) and isinstance(metric.get("name"), str) and metric["name"].strip(), "指标需要 name")
        require(metric.get("status") in {"target", "forecast", "actual", "settled", "unknown"}, "指标 status 需要 target/forecast/actual/settled/unknown")
        require(metric.get("disclosure", "unknown") in {"public", "private", "unknown"}, "指标 disclosure 需要 public/private/unknown")
        text_fields(metric, ("value", "unit", "period", "definition", "owner_scope", "evidence"))
    for ref in facts.get("evidence_refs", []):
        require(isinstance(ref, dict) and isinstance(ref.get("reference"), str) and ref["reference"].strip(), "证据需要 reference（材料标识或位置）")
        text_fields(ref, ("kind", "scope", "version"))
        require(ref.get("disclosure", "unknown") in {"public", "private", "unknown"}, "证据 disclosure 需要 public/private/unknown")


def validate_credentials(data):
    require(isinstance(data.get("credentials", []), list), "credentials 需要列表")
    for c in data.get("credentials", []):
        require(isinstance(c, dict) and isinstance(c.get("name"), str) and c["name"].strip(), "资格事实需要 name")
        require(c.get("kind") in {"training", "certificate", "authorization"}, "资格 kind 需要 training/certificate/authorization")
        require(c.get("status") in {"held", "expired", "pending", "unknown"}, "资格 status 需要 held/expired/pending/unknown")
        require(type(c.get("include_in_resume", False)) is bool, "include_in_resume 需要 true/false")
        text_fields(c, ("issuer", "date", "expires_on", "registration", "evidence"))


def put_entry(state, collection, key, data, confirmed, expected_version=None):
    require(collection in COLLECTIONS, "未知资料类型")
    identifier(key)
    require(isinstance(data, dict), "资料必须是对象")
    old = current(state.get(collection, {}), key)
    if old:
        require(expected_version == old["version"], f"版本冲突：{collection}/{key} 当前为 V{old['version']}，收到 {expected_version}。先 show {collection} {key}，核对并合并后用 --expected-version {old['version']} 更新；不要仅修改版本号强行覆盖。")
    elif expected_version is not None:
        require(expected_version == 0, "新资料的 expected_version 应为 0")
    if collection == "experiences":
        require(data.get("title"), "经历需要标题")
        for field in EXPERIENCE_FIELDS:
            require(data.get(field) is None or isinstance(data[field], str), f"{field} 需要文本")
        validate_facts(data)
    elif collection == "profiles":
        validate_credentials(data)
    elif collection == "answers":
        require(data.get("question") and isinstance(data.get("answer"), str), "回答需要问题与答案")
    elif collection == "debriefs":
        validate_debrief(state, data)
    result = append_version(state.setdefault(collection, {}), key, data, confirmed)
    add_event(state, "library_updated", collection=collection, key=key, version=result["version"])
    return result


def restore_entry(state, collection, key, version):
    require(collection in COLLECTIONS and key in state.get(collection, {}), "资料不存在")
    history = state[collection][key]
    require(1 <= version <= len(history), "版本不存在")
    old = history[version - 1]
    return put_entry(state, collection, key, old["data"], old["confirmed"], history[-1]["version"])


def normalized_question(question):
    return re.sub(r"[\s，。？！、,.?!]", "", question).casefold()


def find_answer(state, question, context="", all_candidates=False):
    normalized = normalized_question(question)
    choices, candidates = [], []
    for key, versions in state["answers"].items():
        item = versions[-1]
        if not item["confirmed"] or item["data"].get("deleted"):
            continue
        data = item["data"]
        similarity = SequenceMatcher(None, normalized, normalized_question(data["question"])).ratio()
        exact = normalized == normalized_question(data["question"]) and context == data.get("context", "")
        dynamic = bool(data.get("requires_recheck") or re.search(r"薪资|薪酬|工资|到岗|入职时间|salary|compensation|availability|notice period|start date", data["question"] + " " + data["answer"], re.I))
        candidate = {"id": key, "version": item["version"], "question": data["question"], "updated_at": item["at"],
                     "reuse": "confirmed" if exact and not dynamic and not all_candidates else "draft_review_required", "similarity": similarity,
                     "answer": data["answer"], "context": data.get("context", ""), "requires_recheck": dynamic,
                     "match": "exact" if exact else "text_similarity", "next_action": "薪资/到岗等信息会变化，核对当前值；本轮已确认的同一版本无需重复提问。" if dynamic else "结合本次岗位语境核对后使用。"}
        candidates.append(candidate)
        if exact or similarity >= .45:
            choices.append(candidate)
    if all_candidates or not choices:
        # No semantic model here: expose materials to the host AI without claiming a semantic match.
        for candidate in candidates:
            candidate.update(reuse="draft_review_required", match="semantic_review_required",
                             next_action="没有可靠的字面命中；由 AI 判断候选是否回答了同一意图，不相关则不用。可用 answer --all-candidates 查看全部已确认材料。" + (" 薪资/到岗等当前值仍需核对。" if candidate["requires_recheck"] else ""))
        candidates.sort(key=lambda x: (x["context"] == context, x["similarity"]), reverse=True)
        return candidates if all_candidates else candidates[:3]
    return sorted(choices, key=lambda x: (x["reuse"] == "confirmed", x["similarity"]), reverse=True)[:3]


def interview(state, session_id, target=None, skip=None, industry=None, segment=None):
    identifier(session_id)
    session = state["interviews"].setdefault(session_id, {"target": target or "", "skipped": [], "rounds": []})
    if target is not None and target != session["target"]:
        session.update(target=target, skipped=[], rounds=[])
    if industry is not None:
        identifier(industry)
        require(industry != "index" and (INDUSTRIES_DIR / (industry + ".md")).is_file(), "行业资料不存在；读取 references/industries/index.md 选择，或不指定行业。")
        session["industry"] = industry
    if segment is not None:
        require(segment in {"campus", "experienced"}, "segment 需要 campus/experienced")
        session["segment"] = segment
    if skip:
        session["skipped"] = sorted(set(session["skipped"]) | set(skip))
    questions = []
    def ask(key, text):
        if key not in session["skipped"]:
            questions.append({"id": key, "question": text})
    if not session["target"]:
        ask("target", "你希望申请什么方向？可以提供一个岗位 JD，或说说想解决哪类问题。")
    experiences = [(key, versions[-1]) for key, versions in state["experiences"].items() if not versions[-1]["data"].get("deleted")]
    target_words = set(re.findall(r"[A-Za-z0-9+#]+|[\u4e00-\u9fff]{2,}", session["target"].lower()))
    experiences.sort(key=lambda pair: -sum(word in str(pair[1]["data"]).lower() for word in target_words))
    if not experiences:
        ask("recall", f"围绕「{session['target'] or '你感兴趣的方向'}」，在工作、课程或个人实践里，哪次解决问题的经历值得展开？从一个小任务说起，没有也可以。")
        ask("timeline", "这件事发生在什么时候？属于哪段工作、学习或个人项目？")
    prompts = {
        "context": "当时谁遇到了什么问题，原来怎样处理？",
        "responsibility": "你亲自负责哪部分？哪些由同事完成？",
        "actions": "你具体怎么做，有哪些方案取舍、失败和调整？",
        "result": "最后交付了什么，产生了什么变化？没有统计数据也可以描述可核实的反馈。",
        "evidence": "有哪些交付物、使用记录或反馈支持这个结果？哪些细节仍不确定？",
    }
    for key, entry in experiences:
        data = entry["data"]
        for field, prompt in prompts.items():
            if not data.get(field):
                ask(key + ":" + field, f"关于「{data['title']}」：{prompt}")
        if not entry["confirmed"]:
            ask(key + ":confirm", f"请核对「{data['title']}」的职责、行动与成果：哪些需要修正，哪些可以确认为真实经历？")
    profile = current(state["profiles"], "personal")
    if not profile or not profile["confirmed"]:
        ask("profile", "简历如何署名？教育、联系方式与技能有哪些已提供的信息可用？可暂缺；由 AI 从原稿整理，只补问尚缺或冲突的内容。")
    if not questions:
        ask("direction_gap", f"对照「{session['target']}」，还有哪类要求缺少真实例子？做过但没写清可以补充，没有做过则如实保留能力缺口。")
    result = {"target": session["target"], "questions": questions[:3], "can_draft": bool(profile and profile["confirmed"] and any(v["confirmed"] and any(v["data"].get(f) for f in ("responsibility", "actions", "result")) for _, v in experiences)), "hint": "用户只需自然语言回答；AI 参考 examples/profile.json 与 experience.json 整理 JSON，通过 library-put 保存，确认后加 --confirmed。已有记录先 show，按当前 --expected-version 更新。可跳过；未做过的事情不能写成已完成经历。"}
    if session.get("industry"):
        result["industry_guide"] = str(INDUSTRIES_DIR / (session["industry"] + ".md"))
        result["segment"] = session.get("segment")
        result["hint"] += " 读取行业资料中适用的校招/社招小节；问题是可选提示，只补问原稿与已确认经历中尚缺的事实，每轮仍最多三问。"
    session["rounds"].append({"at": now(), "question_ids": [q["id"] for q in result["questions"]]})
    return result


def select_resume(state, key, resume_id):
    require(key in state["jobs"] and resume_id in state["resumes"], "岗位或简历版本不存在")
    state["jobs"][key]["selected_resume"] = resume_id
    add_event(state, "resume_selected", key=key, resume_id=resume_id)
