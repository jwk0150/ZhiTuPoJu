# -*- coding: utf-8 -*-
"""JobMatchingAgent —— 人岗匹配 Agent（Phase 08-B）。

职责边界（严格分层）：
    Frontend
      ↓
    API（/api/match/agent）
      ↓
    JobMatchingAgent（意图识别 + Tool 编排 + 自然语言解释）
      ↓
    Tools（包装已有 Service，不含业务逻辑 / 不含 SQL）
      ↓
    Services（matching.service / knowledge.service / evidence）
      ↓
    DB / RAG / Evidence

原则：
- 确定性业务计算（解析 / 召回 / 评分 / 证据）一律交给已有 Service，Agent 不重算。
- Agent 不直接写 SQL、不生成岗位、不创建 Evidence、不编造技能。
- 重要结论必须带 Evidence（claim → evidence_ids / source_url）。
- DeepSeek 失败 → 返回结构化数据 + fallback 文案，不崩溃。
- 普通"开始匹配"直接走确定性流程，不无意义调用 LLM 决策。
"""

from __future__ import annotations

import json
import re
from copy import deepcopy
from typing import Any

from backend.llm import deepseek as ds
from backend.matching import service as ms

# ---------------------------------------------------------------
# 一、Intent 分类（简单规则，不依赖 LLM）
# ---------------------------------------------------------------
INTENT_RULES: list[tuple[str, list[str]]] = [
    ("WHAT_IF", ["如果", "假如", "假设", "加上", "增加", "学会", "补上", "提升到", "掌握后"]),
    ("EXPLAIN", ["为什么", "凭什么", "理由", "解释", "原因", "推荐这个", "怎么匹配上", "为什么适合"]),
    ("GAP", ["缺什么", "缺口", "差距", "不足", "不会", "能力差距", "技能差距", "短板", "差哪些", "缺少", "缺哪些", "缺啥"]),
    ("LEARNING", ["学习", "提升", "怎么补", "如何提升", "学习路径", "成长", "怎么学", "补能力", "学习建议"]),
    ("JOB_ANALYSIS", ["岗位分析", "分析这个岗位", "这个岗位怎么样", "这个岗位情况", "这个岗位具体", "详细介绍岗位", "岗位职责", "这个岗位是", "岗位要求是", "岗位有什么要求"]),
    ("MATCH", ["推荐", "适合", "匹配", "开始", "帮我找", "找工作", "投递", "岗位推荐"]),
]

_SKILL_TOKEN_RE = re.compile(r"[\u4e00-\u9fffA-Za-z0-9+#.]{2,}")
_SKILL_STOP = {
    "什么", "哪些", "怎么", "如何", "需要", "岗位", "请问", "一下", "这个", "那个",
    "可以", "我们", "你们", "如果", "加上", "增加", "学会", "能力", "技能", "后", "会",
}


def classify_intent(message: str) -> str:
    """返回 Intent。默认 MATCH（对无信号输入保守地走确定性匹配）。"""
    text = (message or "").strip().lower()
    if not text:
        return "MATCH"
    for name, kws in INTENT_RULES:
        if any(k.lower() in text for k in kws):
            return name
    return "MATCH"


def _skills_from_message(message: str, candidates: list[str]) -> list[str]:
    """从消息里识别消息中出现过的候选技能名（大小写不敏感）。"""
    text = (message or "").lower()
    hits = []
    for s in candidates:
        if not s:
            continue
        if str(s).lower() in text and str(s).lower() not in hits:
            hits.append(str(s))
    return hits


# ---------------------------------------------------------------
# 二、Tool 层 —— 只包装已有 Service，禁止写业务逻辑
# ---------------------------------------------------------------
class JobMatchingTools:
    """Agent 可用的业务工具。每个 Tool 底层都调用已有 Service 函数。"""

    # ---- Resume Tools ----
    def get_resume_profile(self, resume_text: str, filename: str = "resume.txt"):
        """简历 → 结构化画像（复用 parse_resume）。"""
        return ms.parse_resume(resume_text or "", filename or "resume.txt")

    def get_resume_document(self, resume_text: str, filename: str = "resume.txt") -> dict:
        """简历原文 + 版面解析结果。"""
        return {"text": resume_text or "", "filename": filename or "resume.txt"}

    # ---- Job Tools ----
    def search_jobs(self, profile: dict, top_k: int = 50) -> list[dict]:
        """按画像召回真实岗位（KnowledgeService Hybrid Retrieval）。"""
        return ms.retrieve_candidate_jobs(profile, top_k=top_k)

    def get_job(self, job_id, matches: list[dict]) -> dict | None:
        """从已有匹配结果里取岗位详情。"""
        for m in matches or []:
            job = m.get("job") or {}
            if str(job.get("id")) == str(job_id):
                return {**job, "_match": m}
        return None

    # ---- Matching Tools ----
    def calculate_job_match(self, profile: dict, jobs: list[dict]) -> list[dict]:
        """五维匹配评分（确定性计算，不调用 LLM）。"""
        reviews, _ = ms._semantic_review(profile, jobs or [])
        matches = ms.score_matches(profile, reviews, jobs=jobs or [])
        for m in matches:
            m["evidence"] = (m.get("job") or {}).get("_evidence", [])
        return matches

    def get_match_result(self, profile: dict, jobs: list[dict], target_job_id=None) -> dict:
        """完整确定性诊断（评分 + Evidence + 解释 + 学习路径）。"""
        return ms.diagnose_from_profile(
            profile, jobs or [], target_job_id=target_job_id, mode="b",
        )

    # ---- Knowledge / Evidence Tools ----
    def search_knowledge(self, query: str, top_k: int = 10) -> dict:
        from backend.knowledge.service import KnowledgeService

        return KnowledgeService().hybrid_search(query or "", top_k=top_k)

    def get_evidence(self, evidence_id) -> dict | None:
        from backend.knowledge import evidence as ev

        return ev.get_evidence_chain(evidence_id)

    # ---- Career Tools ----
    def analyze_skill_gap(self, match: dict) -> dict:
        """技能缺口 + gap_paths（从评分结果直接提取，不重算）。"""
        return {
            "matched": match.get("matched") or [],
            "missing": match.get("missing") or [],
            "gaps": match.get("gaps") or [],
            "gap_paths": match.get("gap_paths") or [],
            "dimensions": match.get("dimensions") or {},
        }

    def get_learning_path(self, match: dict) -> list[dict]:
        return ms.build_learning_path(match)

    def what_if_match(
        self, profile: dict, jobs: list[dict], skill: str, level: int = 5
    ) -> dict:
        """What-if：克隆画像并提升指定技能后重算匹配（确定性，不落库）。"""
        before = self.calculate_job_match(profile, jobs)
        profile2 = deepcopy(profile)
        found = False
        for sk in profile2.get("skills") or []:
            if str(sk.get("name") or "").lower() == skill.lower():
                sk["level"] = "精通"
                sk["strength"] = level
                sk["readiness"] = max(int(sk.get("readiness") or 0), 95)
                found = True
                break
        if not found:
            (profile2.setdefault("skills", [])).append(
                {"name": skill, "level": "精通", "strength": level, "readiness": 95}
            )
        after = self.calculate_job_match(profile2, jobs)
        return {"before": before, "after": after}

    def analyze_job(self, job: dict) -> dict:
        """岗位需求分析（LLM 摘要岗位要求；失败返回结构化字段）。"""
        try:
            return ms.analyze_job_requirement(job)
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc), "required": job.get("required_skills") or [],
                    "preferred": job.get("preferred_skills") or []}


# ---------------------------------------------------------------
# 三、Prompts
# ---------------------------------------------------------------
_SYSTEM = (
    "你是「执图破局」的 JobMatchingAgent，专注人岗匹配决策分析。"
    "任务：基于用户提供的候选人画像、真实岗位、匹配分数与 Evidence 数据，回答用户问题。"
    "铁律：只能引用提供数据中的事实（岗位技能要求、匹配/缺失技能、Evidence 原文、来源链接）；"
    "不得编造岗位、技能、证据或来源；证据不足时明确写「INSUFFICIENT_EVIDENCE」。"
    "回答风格：先给结论，再给 2~4 条依据（尽量引用证据与来源）；中文口语专业；"
    "只输出最终结论与依据，不要展示内部推理过程。"
)

_INTENT_HINTS: dict[str, str] = {
    "MATCH": "用户想要岗位推荐：给出最匹配的 3~5 个岗位、匹配度、关键匹配/缺失技能。",
    "EXPLAIN": "用户询问为何推荐某岗位：解释匹配度来源，指出哪些技能命中、哪些缺失，并引用 Evidence 出处。",
    "GAP": "用户想知道能力缺口：列出主要缺失技能、差距大小与补强方向。",
    "WHAT_IF": "用户假设提升某技能后的变化：对比 before/after 匹配度与缺口变化，给出客观结论。",
    "JOB_ANALYSIS": "用户想了解岗位本身：岗位职责、硬性要求、加分项，引用岗位描述与 Evidence。",
    "LEARNING": "用户想提升：给出按优先级排列的学习路径步骤与可执行交付物。",
}


def _prompt(intent: str, context: dict[str, Any], message: str) -> list[dict[str, str]]:
    system = _SYSTEM + "\n" + _INTENT_HINTS.get(intent, "")
    ctx_json = json.dumps(context, ensure_ascii=False, default=str)[:6000]
    return [
        {"role": "system", "content": system},
        {"role": "system", "content": "可参考的上下文数据(JSON):\n" + ctx_json},
        {"role": "user", "content": message or "请给出分析"},
    ]


# ---------------------------------------------------------------
# 四、确定性 fallback 文案（DeepSeek 失败时使用）
# ---------------------------------------------------------------
def _fallback_answer(intent: str, payload: dict[str, Any]) -> str:
    if intent == "MATCH":
        matches = payload.get("matches") or []
        if not matches:
            return "当前未找到合适的岗位，可尝试放宽条件后重新匹配。"
        lines = [f"为你找到 {len(matches)} 个匹配岗位："]
        for m in matches[:5]:
            job = m.get("job") or {}
            lines.append(
                f"- {job.get('title')}（{job.get('company')}）匹配度 {m.get('score')}，"
                f"匹配 {len(m.get('matched') or [])} 项、缺失 {len(m.get('missing') or [])} 项。"
            )
        return "\n".join(lines)
    if intent == "EXPLAIN":
        m = payload.get("match") or {}
        job = m.get("job") or {}
        matched = "、".join(m.get("matched") or []) or "无"
        missing = "、".join(m.get("missing") or []) or "无"
        return (
            f"该岗位「{job.get('title')}」与你的匹配度为 {m.get('score')}。"
            f"命中的技能：{matched}；尚未覆盖：{missing}。"
            f"依据来自岗位描述与检索证据（{len(payload.get('evidence') or [])} 条）。"
        )
    if intent == "GAP":
        m = payload.get("match") or {}
        missing = "、".join((m.get("missing") or [])[:8]) or "无"
        return f"当前主要技能缺口：{missing}。建议优先补齐与目标岗位强相关的 1~2 项，再按学习路径推进。"
    if intent == "WHAT_IF":
        skill = payload.get("skill")
        before = payload.get("before_score")
        after = payload.get("after_score")
        if not skill:
            return "未在消息中识别到具体技能，请明确说明想提升的技能（如：增加 Redis 能力）。"
        return f"模拟提升「{skill}」后，匹配度由 {before} 提升至 {after}。该结论为本地模拟，不改变真实简历。"
    if intent == "JOB_ANALYSIS":
        job = payload.get("job") or {}
        req = "、".join((job.get("required_skills") or [])[:10]) or "无明确要求"
        pref = "、".join((job.get("preferred_skills") or [])[:6]) or "无"
        return f"「{job.get('title')}」硬性要求：{req}；加分项：{pref}。详见岗位详情与检索证据。"
    if intent == "LEARNING":
        lp = payload.get("learning_path") or []
        if not lp:
            return "暂无学习路径数据，先完成一次人岗匹配后再查看。"
        steps = "\n".join(
            f"- {s.get('title')}（{s.get('weeks') or '?'} 周）" for s in lp[:6]
        )
        return f"建议学习路径：\n{steps}"
    return "已生成结构化分析结果。"


# ---------------------------------------------------------------
# 五、上下文构建（保证 EXPLAIN/GAP 等有 profile / matches）
# ---------------------------------------------------------------
def _ensure_context(
    *,
    resume_text: str | None,
    filename: str,
    context: dict[str, Any],
    selected_job_id,
    tools: JobMatchingTools,
) -> tuple[dict, list[dict], Any]:
    """返回 (profile, matches, selected_job_id)。缺什么补什么，缺数据不编造。"""
    profile = context.get("profile")
    matches = context.get("matches") or []
    if profile is None and resume_text:
        profile, _ = tools.get_resume_profile(resume_text, filename)
    if not matches and profile:
        try:
            jobs = tools.search_jobs(profile, top_k=50)
            if jobs:
                result = ms.diagnose_from_profile(
                    profile, jobs, target_job_id=None, mode="b",
                    parse_meta={"llm": "none", "error": None},
                )
                matches = result.get("matches") or []
                if not context:
                    context = {}
                context.setdefault("gap_graph", result.get("gap_graph"))
                context.setdefault("learning_path", result.get("learning_path"))
                context.setdefault("model", result.get("model"))
        except Exception:  # noqa: BLE001 —— 数据缺失时不崩，交给调用方提示
            matches = []
    if selected_job_id is None:
        selected_job_id = (matches[0]["job"]["id"] if matches else None)
    return profile, matches, selected_job_id


def _confidence_of(match: dict | None) -> dict[str, Any]:
    from backend.knowledge import evidence as ev

    count = len((match or {}).get("evidence") or [])
    level, conf, unc = ev.evidence_confidence(count)
    return {"level": level, "confidence": conf, "uncertainty": unc}


def _pick_match(matches: list[dict], selected_job_id):
    if not matches:
        return None
    if selected_job_id is not None:
        for m in matches:
            if str(m["job"]["id"]) == str(selected_job_id):
                return m
    return matches[0]


def _evidence_items(match: dict | None) -> list[dict]:
    out = []
    for ev in (match or {}).get("evidence") or []:
        out.append({
            "evidence_id": ev.get("evidence_id"),
            "chunk_id": ev.get("chunk_id"),
            "doc_id": ev.get("doc_id"),
            "source_url": ev.get("source_url"),
            "snippet": (ev.get("snippet") or "")[:200],
            "score": ev.get("score"),
        })
    return out


# ---------------------------------------------------------------
# 六、Agent 主入口
# ---------------------------------------------------------------
def run(
    *,
    message: str = "",
    resume_text: str | None = None,
    filename: str = "resume.txt",
    context: dict[str, Any] | None = None,
    selected_job_id=None,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    """JobMatchingAgent 主入口。

    message     ：用户自然语言意图
    resume_text ：简历文本（缺 profile 时用于构建画像）
    context     ：可选上下文 {profile, matches, gap_graph, learning_path, ...}
    selected_job_id：本次关注的岗位 id
    """
    context = context or {}
    intent = classify_intent(message)
    tools = JobMatchingTools()
    profile, matches, selected_job_id = _ensure_context(
        resume_text=resume_text, filename=filename,
        context=context, selected_job_id=selected_job_id, tools=tools,
    )

    # ---------- 确定性流程：MATCH ----------
    if intent == "MATCH":
        if not matches:
            return {
                "intent": "MATCH", "summary": "暂无可用的匹配结果。请先上传简历完成一次诊断。",
                "matches": [], "selected_job_id": None, "confidence": "low", "uncertainty": 0.7,
                "model": {"used": False, "mode": "no-jobs", "error": "未找到候选岗位"},
            }
        payload = {
            "matches": [{ "job": m.get("job"), "score": m.get("score"),
                          "matched": m.get("matched"), "missing": m.get("missing"),
                          "confidence": m.get("confidence") } for m in matches],
        }
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, payload)
        return {
            "intent": "MATCH",
            "summary": llm_text,
            "matches": matches,
            "selected_job_id": selected_job_id,
            "confidence": _confidence_of(matches[0] if matches else None)["level"],
            "uncertainty": _confidence_of(matches[0] if matches else None)["uncertainty"],
            "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                      "error": meta.get("error")},
        }

    # ---------- 解释 / 缺口 / 岗位分析 / 学习 / What-if ----------
    match = _pick_match(matches, selected_job_id)
    base = {
        "intent": intent,
        "selected_job_id": selected_job_id,
        "model": {"used": False, "mode": "fallback", "error": None},
    }

    if intent == "EXPLAIN":
        if not match:
            return {**base, "answer": "缺少可解释的匹配结果。", "evidence": [],
                    "confidence": "low", "uncertainty": 0.7}
        payload = {
            "match": {
                "score": match.get("score"),
                "matched": match.get("matched"),
                "missing": match.get("missing"),
                "reason": (match.get("match_reasons") or [None])[0],
                "job": match.get("job"),
            },
            "evidence": _evidence_items(match),
        }
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, {"match": match, "evidence": payload["evidence"]})
        conf = _confidence_of(match)
        return {
            **base, "answer": llm_text, "target_job": match.get("job"),
            "evidence": payload["evidence"], "confidence": conf["level"],
            "uncertainty": conf["uncertainty"],
            "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                      "error": meta.get("error")},
        }

    if intent == "GAP":
        if not match:
            return {**base, "answer": "缺少可分析的匹配结果。", "gaps": [],
                    "learning_path": [], "confidence": "low", "uncertainty": 0.7}
        gap = tools.analyze_skill_gap(match)
        lp = context.get("learning_path") or tools.get_learning_path(match)
        payload = {**gap, "learning_path": lp[:8], "job": match.get("job")}
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, {"match": match, "learning_path": lp})
        return {**base, "answer": llm_text, **gap, "learning_path": lp,
                "confidence": "medium", "uncertainty": 0.4,
                "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                          "error": meta.get("error")}}

    if intent == "JOB_ANALYSIS":
        job = (match.get("job") if match else None)
        if not job:
            return {**base, "answer": "缺少岗位数据。", "evidence": [],
                    "confidence": "low", "uncertainty": 0.7}
        analysis = tools.analyze_job(job)
        payload = {"job": job, "analysis": analysis,
                   "evidence": _evidence_items(match)}
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, {"job": job})
        return {**base, "answer": llm_text, "target_job": job,
                "analysis": analysis, "evidence": payload["evidence"],
                "confidence": "medium", "uncertainty": 0.4,
                "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                          "error": meta.get("error")}}

    if intent == "LEARNING":
        if not match:
            return {**base, "answer": "缺少学习路径数据。", "learning_path": [],
                    "confidence": "low", "uncertainty": 0.7}
        lp = context.get("learning_path") or tools.get_learning_path(match)
        payload = {"learning_path": lp[:8], "match": {
            "score": match.get("score"), "missing": match.get("missing")}}
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, {"learning_path": lp})
        return {**base, "answer": llm_text, "learning_path": lp,
                "confidence": "medium", "uncertainty": 0.4,
                "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                          "error": meta.get("error")}}

    if intent == "WHAT_IF":
        if not match or not profile:
            return {**base, "answer": "What-if 需要先有画像与匹配结果。",
                    "skill": None, "before": None, "after": None,
                    "confidence": "low", "uncertainty": 0.7}
        candidates = []
        for sk in (profile.get("skills") or []):
            candidates.append(str(sk.get("name") or ""))
        for m in matches:
            job = m.get("job") or {}
            candidates += (job.get("required_skills") or [])
            candidates += (job.get("preferred_skills") or [])
        candidates = list(dict.fromkeys(c for c in candidates if c))
        hits = _skills_from_message(message, candidates)
        if not hits:
            return {**base, "answer": "未在消息中识别到具体技能，请明确说明想提升的技能（如：增加 Redis 能力）。",
                    "skill": None, "before": None, "after": None,
                    "confidence": "low", "uncertainty": 0.7}
        skill = hits[0]
        try:
            jobs = tools.search_jobs(profile, top_k=50)
            wf = tools.what_if_match(profile, jobs, skill)
        except Exception as exc:  # noqa: BLE001
            return {**base, "answer": f"What-if 模拟失败：{exc}。",
                    "skill": skill, "before": None, "after": None,
                    "confidence": "low", "uncertainty": 0.7}
        before_top = sorted(wf["before"], key=lambda x: x.get("score") or 0, reverse=True)
        after_top = sorted(wf["after"], key=lambda x: x.get("score") or 0, reverse=True)
        before_score = before_top[0].get("score") if before_top else None
        after_score = after_top[0].get("score") if after_top else None
        before_missing = before_top[0].get("missing") if before_top else []
        after_missing = after_top[0].get("missing") if after_top else []
        changes = list(dict.fromkeys(
            [s for s in before_missing if s not in (after_missing or [])]
        ))
        payload = {
            "skill": skill, "before_score": before_score, "after_score": after_score,
            "before_missing": before_missing[:8], "after_missing": after_missing[:8],
            "changes": changes[:8],
        }
        llm_text, meta = ds.chat_completions(_prompt(intent, payload, message))
        if not llm_text:
            llm_text = _fallback_answer(intent, payload)
        return {
            **base, "answer": llm_text, "skill": skill,
            "before": {"score": before_score, "missing": before_missing[:8]},
            "after": {"score": after_score, "missing": after_missing[:8]},
            "changes": changes[:8],
            "confidence": "medium", "uncertainty": 0.4,
            "model": {"used": bool(meta.get("llm")), "mode": meta.get("llm") and "llm" or "fallback",
                      "error": meta.get("error")},
        }

    return {**base, "answer": "暂不支持的意图。", "confidence": "low", "uncertainty": 0.7}
