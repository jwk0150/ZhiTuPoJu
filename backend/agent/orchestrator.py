# -*- coding: utf-8 -*-
"""Global Orchestrator —— Global Agent 编排层（Phase 2）。

执行模型（Phase 2 无 Agent Loop / 无 Function Calling）：
    Authentication → ContextBuilder → IntentClassifier → Tool Selection
    → Tool Execution（Tool Registry → 现有 Service）→ Result Normalization
    → DeepSeek 解释（仅基于真实数据）→ 结构化 Response

原则：
- 规则优先意图分类（复用项目现有 classify_intent 模式），不用 LLM 决策。
- 数据优先：确定性 DB 结果 > 算法结果 > RAG > LLM 表达；LLM 只解释不编造。
- Reasoning Summary 只记录真实 Tool 执行步骤，禁止输出原始 CoT。
- 写权限（WRITE/DELETE）在 Phase 2 一律不执行。
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional

from backend.agent.context import ContextBuilder
from backend.agent import evidence as ev_mod
from backend.agent import tools as tools_mod
from backend.agent import validator as val_mod
from backend.llm import deepseek as ds

# ============================================================
# 意图分类（规则优先）
# ============================================================
INTENT_RULES: list[tuple[str, list[str]]] = [
    ("navigation", ["打开", "跳转", "进入", "去页面", "查看页面"]),
    ("what_if", ["如果", "假如", "假设", "提升到", "学会", "补上", "掌握后", "增加到"]),
    ("resume_optimize", ["优化简历", "改简历", "简历优化", "润色简历", "简历应该怎么改", "简历怎么改", "改得更适合", "优化一下简历"]),
    ("skill_gap", ["差在哪里", "缺什么", "缺口", "差距", "不足", "短板", "差哪些", "缺哪些", "能力差距", "技能差距"]),
    ("job_match", ["适不适合", "匹配度", "匹配吗", "能不能胜任", "我适合", "适合我吗", "合不合适"]),
    ("resume_analyze", ["分析简历", "简历分析", "看看我的简历", "评估简历", "我的简历", "分析一下我的简历"]),
    ("career_forecast", ["预测", "未来会", "将来", "发展前景", "趋势预测"]),
    ("career_evolution", ["需要什么能力", "能力要求", "最近需要", "能力模型", "能力变化", "岗位演化", "升级"]),
    ("job_discovery", ["发现", "新岗位", "新兴岗位", "新方向", "发现岗位"]),
    ("knowledge", ["为什么", "什么是", "介绍一下", "介绍", "行业", "政策", "报告", "解释一下", "背景"]),
    ("job_search", ["找", "搜索", "查一下", "找工作", "帮我找", "有哪些", "推荐岗位", "找岗位"]),
    ("profile", ["画像", "我的能力", "职业报告", "我的情况", "能力怎么样"]),
]


def classify_intent(message: str) -> str:
    text = (message or "").strip().lower()
    if not text:
        return "profile"
    # 复合任务：找岗 + 差距 + 改简历 → 确定性 Pipeline（Phase 2 §20）
    has_job = any(k in text for k in ("找", "岗位", "职位", "推荐"))
    has_gap = any(k in text for k in ("差距", "缺口", "缺", "差在哪里"))
    has_change = any(k in text for k in ("改", "优化", "修改"))
    if has_job and has_gap and has_change:
        return "job_match_prep"
    for name, kws in INTENT_RULES:
        if any(k in text for k in kws):
            return name
    return "profile"


def _extract_job_keyword(message: str) -> str:
    """从消息中粗略提取岗位关键词（规则清洗，不调用 LLM）。"""
    text = str(message or "")
    for w in ("帮我", "请帮我", "看看", "找找", "搜索", "查一下", "查找", "给我",
              "推荐", "适合", "分析", "这个", "岗位", "职位", "工作", "相关的",
              "的岗位", "的职位", "有哪些", "什么", "最近", "需要", "能力"):
        text = text.replace(w, "")
    text = re.sub(r"[\s，。？?！!：:、，]+", " ", text).strip()
    return text[:30]


def _extract_skill(message: str, candidates: list[str]) -> Optional[str]:
    """从消息中识别候选技能名（大小写不敏感，复用现有识别思路）。"""
    low = (message or "").lower()
    for c in candidates:
        if c and str(c).lower() in low:
            return str(c)
    return None


def _extract_number(message: str) -> Optional[int]:
    m = re.search(r"(\d{1,3})", message or "")
    return int(m.group(1)) if m else None


def _navigation_page(intent: str, job_key: Any = None) -> Optional[dict]:
    pages = {
        "resume_analyze": "resume",
        "resume_optimize": "resume",
        "job_search": "match",
        "job_match": "match",
        "job_match_prep": "match",
        "skill_gap": "match",
        "what_if": "match",
        "career_evolution": "evolution",
        "career_forecast": "evolution",
        "job_discovery": "discovery",
        "knowledge": None,
        "profile": "match",
        "navigation": None,
    }
    page = pages.get(intent)
    if not page:
        return None
    nav = {"page": page}
    if job_key is not None:
        nav["query"] = {"job_id": job_key}
    return nav


# ============================================================
# Tool 执行器（记录 reasoning_steps / tool_calls / evidence）
# ============================================================
class _ToolRunner:
    def __init__(self, user: dict, ctx: dict) -> None:
        self.user = user
        self.ctx = ctx
        self.steps: list[dict] = []
        self.tool_calls: list[dict] = []
        self.evidence: list[dict] = []
        self.warnings: list[str] = []
        self.claims: list[dict] = []          # ResearchAgent 输出的 claims（供 Validator）
        self.response_status: str = "ok"       # 可被 pipeline 覆写（如 insufficient_evidence）
        self._step_no = 0

    def run(self, name: str, params: dict, step_title: str) -> dict:
        self._step_no += 1
        tool = tools_mod.get_tool(name)
        if not tool:
            self._record(name, step_title, "error", "TOOL_NOT_FOUND", "工具不存在", params)
            return {"ok": False, "tool": name, "error": {"code": "TOOL_NOT_FOUND", "message": "工具不存在"}}
        if tool["permission"] in tools_mod.WRITE_PERMISSIONS:
            self._record(name, step_title, "blocked", "PERMISSION_DENIED",
                         "Phase 2 不允许写操作", params)
            return {"ok": False, "tool": name, "error": {"code": "PERMISSION_DENIED", "message": "Phase 2 暂不允许写操作"}}
        try:
            result = tool["handler"](user=self.user, params=params, ctx=self.ctx)
        except Exception as exc:  # noqa: BLE001
            result = {"ok": False, "tool": name, "error": {"code": "TOOL_ERROR", "message": str(exc)}}
        call_status = "ok" if result.get("ok") else "error"
        self._record(name, step_title, call_status,
                     result.get("error", {}).get("code") if not result.get("ok") else None,
                     result.get("error", {}).get("message") if not result.get("ok") else None,
                     params, result=result)
        if result.get("ok"):
            for ev in result.get("evidence") or []:
                if ev not in self.evidence:
                    self.evidence.append(ev)
            for w in result.get("warnings") or []:
                if w not in self.warnings:
                    self.warnings.append(w)
        return result

    def _record(self, name, title, status, err_code, err_msg, params, result=None):
        # tool_calls.status: ok / error / blocked；steps.status: done / error / blocked
        step_status = "done" if status == "ok" else status
        self.tool_calls.append({
            "tool": name,
            "status": status,
            "params": {k: v for k, v in (params or {}).items() if k not in ("profile", "jobs", "match", "diagnose_result")},
            "result_summary": tools_mod._short((result or {}).get("data")) if (result or {}).get("ok") else None,
            "error": {"code": err_code, "message": err_msg} if err_code else None,
        })
        self.steps.append({
            "step": self._step_no,
            "title": title,
            "status": step_status,
            "tool_used": name,
            "evidence_count": len((result or {}).get("evidence") or []) if (result or {}).get("ok") else 0,
            "detail": err_msg or "",
        })

    def add_manual_step(self, title: str, status: str = "done", detail: str = "") -> None:
        self._step_no += 1
        self.steps.append({"step": self._step_no, "title": title, "status": status,
                           "tool_used": None, "evidence_count": 0, "detail": detail})


def _confidence(evidence: list[dict]) -> str:
    count = len(evidence)
    if count >= 2:
        return "high"
    if count >= 1:
        return "medium"
    return "low"


# ============================================================
# LLM 解释（数据优先，禁止编造）
# ============================================================
_SYSTEM = (
    "你是「执图破局」的 Global AI 助手，负责用自然语言解释系统返回的真实数据。\n"
    "铁律：\n"
    "1. 只能使用 GROUND_TRUTH 中的数据，禁止编造、修改、推测任何数值/岗位/技能/来源。\n"
    "2. 如果用户声称的数值与 GROUND_TRUTH 不一致，必须以 GROUND_TRUTH 为准，并礼貌指正。\n"
    "3. 数据不足时如实说明，不要补充编造内容。\n"
    "4. 输出：先给结论，再给 2~4 条依据（引用真实数值/技能/来源），中文口语专业，不超过 180 字。"
)


def _explain(intent: str, user_question: str, data_blob: Any, fallback: str) -> str:
    blob_json = json.dumps(data_blob, ensure_ascii=False, default=str)[:5000]
    user = f"用户问题：{user_question}\n\nGROUND_TRUTH（唯一事实来源，不得修改）：\n{blob_json}"
    content, meta = ds.chat_completions(
        [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
        timeout=45.0,
    )
    if not content:
        return fallback
    return content


def build_final_reply(user: dict, task: dict, steps: list, evidence: list,
                      completed: int, total: int) -> str:
    """基于真实执行结果生成任务最终自然语言回复（Phase 5）。

    保证：即使 LLM 调用失败或返回极短内容，fallback 也包含技能/岗位/匹配度等真实数据，
    用户始终能看到实质内容（不再输出"任务已完成"等机械/空壳字符串）。
    """
    intent = task.get("intent") or "profile"
    question = ((task.get("input") or {}).get("message")) or ""
    # knowledge 类工具已产出最终答案，直接复用，避免二次解释
    if intent == "knowledge":
        for s in steps:
            if s.get("tool") == "knowledge.ask" and s.get("result"):
                ans = (s.get("result") or {}).get("answer")
                if ans:
                    return str(ans)
    extracted = _extract_step_data(steps)
    blob = {
        "intent": intent,
        "completed_steps": completed,
        "total_steps": total,
        "steps_data": extracted,
        "evidence": [ev_mod.normalize_evidence(e) for e in evidence][:20],
    }
    fallback = _build_rich_fallback(intent, extracted, completed, total, len(evidence))
    reply = _explain(intent, question, blob, fallback)
    # 兜底再校验：若 LLM 返回过短或机械摘要，仍使用丰富 fallback
    if not reply or len(reply.strip()) < 12 or reply.strip().startswith("任务已完成"):
        return fallback
    return reply


def _extract_step_data(steps: list) -> dict:
    """从已执行步骤的真实 result 中提炼关键数据，供 LLM 与 fallback 共用。"""
    out: dict = {}
    for s in steps:
        tool = s.get("tool"); r = s.get("result")
        if not isinstance(r, dict):
            continue
        if tool == "context.get_current":
            cg = r.get("career_goal") or {}
            skills = r.get("skills") or []
            out["profile"] = {
                "target_job": cg.get("target_job") or r.get("target_job"),
                "skill_count": len(skills),
                "skills": [{"name": (sk.get("skill_name") or sk.get("name")),
                            "score": sk.get("score"), "level": sk.get("level")}
                           for sk in skills[:10]],
                "ability_count": len(r.get("abilities") or []),
                "overall_score": (r.get("latest_report") or {}).get("overall_score"),
                "completion": r.get("completion"),
            }
        elif tool == "job.search":
            jobs = r.get("jobs") or []
            out["jobs"] = {
                "total": r.get("total"),
                "top": [{"title": j.get("job_title"), "company": j.get("company_name"),
                         "city": j.get("city")}
                        for j in jobs[:5]],
            }
        elif tool == "job.recall":
            jobs = r.get("jobs") or []
            out["recalled_jobs"] = {"count": len(jobs),
                                    "top": [j.get("job_title") for j in jobs[:5]]}
        elif tool == "match.analyze":
            matches = r.get("matches") or []
            if matches:
                top = matches[0]
                job = top.get("job") or {}
                out["match"] = {
                    "score": top.get("score"),
                    "title": job.get("title"),
                    "company": job.get("company"),
                    "city": job.get("city"),
                    "matched": top.get("matched") or [],
                    "missing": top.get("missing") or [],
                    "top3": [{"title": (m.get("job") or {}).get("title"),
                              "score": m.get("score")} for m in matches[:3]],
                }
        elif tool == "match.skill_gap":
            out["skill_gap"] = {
                "missing": (r.get("missing") or [])[:8],
                "gap_paths": (r.get("gap_paths") or [])[:6],
            }
        elif tool == "resume.analyze":
            out["resume"] = {
                "skill_count": len(r.get("skills") or []),
                "overall_score": r.get("overall_score"),
                "advantages": (r.get("advantages") or [])[:5],
                "weaknesses": (r.get("weaknesses") or [])[:5],
            }
    return out


def _build_rich_fallback(intent: str, data: dict, completed: int, total: int, ev_count: int) -> str:
    """即使 LLM 不可用，也输出含真实技能/岗位/匹配度的具体内容。"""
    lines: list[str] = [f"任务已完成（执行 {completed}/{total} 步，证据 {ev_count} 条）。"]
    p = (data or {}).get("profile") or {}
    j = (data or {}).get("jobs") or {}
    rj = (data or {}).get("recalled_jobs") or {}
    m = (data or {}).get("match") or {}
    sg = (data or {}).get("skill_gap") or {}
    res = (data or {}).get("resume") or {}

    if p:
        if p.get("target_job"):
            lines.append(f"你的目标岗位是「{p['target_job']}」。")
        if p.get("skill_count"):
            names = "、".join((s.get("name") or "?") for s in (p.get("skills") or [])[:8])
            lines.append(f"已识别技能 {p['skill_count']} 项：{names}。")
        if p.get("overall_score") is not None:
            lines.append(f"最近职业报告综合分 {p['overall_score']}。")
        if not any([p.get("target_job"), p.get("skill_count")]):
            lines.append("当前画像数据较少，建议先完善简历或填写能力问卷。")
    if j.get("top"):
        lines.append(f"为你找到 {j.get('total') or len(j['top'])} 条相关岗位，前几名：")
        for x in j["top"][:5]:
            lines.append(f"- {x.get('title')} @ {x.get('company')}（{x.get('city') or '?'}）")
    elif rj.get("count"):
        lines.append(f"召回候选岗位 {rj['count']} 个：{('、'.join(rj['top'][:5]))}。")
    if m.get("title"):
        score = m.get("score")
        lines.append(f"最佳匹配「{m['title']}」@ {m.get('company')}（{m.get('city') or '?'}），匹配度 {score}。")
        if m.get("matched"):
            lines.append("优势：" + "、".join(str(s) for s in m["matched"][:6]))
        if m.get("missing"):
            lines.append("差距：" + "、".join(str(s) for s in m["missing"][:6]))
    if sg.get("missing"):
        lines.append("技能缺口：" + "、".join(str(s) for s in sg["missing"][:8]))
        if sg.get("gap_paths"):
            lines.append("可迁移路径：" + "；".join(
                f"{p.get('from')}→{p.get('to')}" for p in sg["gap_paths"][:4]))
    if res:
        if res.get("skill_count") is not None:
            lines.append(f"简历识别到技能 {res['skill_count']} 项，综合分 {res.get('overall_score')}。")
        if res.get("weaknesses"):
            lines.append("主要不足：" + "、".join(str(w) for w in res["weaknesses"][:3]))

    out = "\n".join(lines).strip()
    return out or f"任务已完成（执行 {completed}/{total} 步）。"


# ============================================================
# 各意图 Pipeline
# ============================================================
def _pipeline_profile(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    """我的画像 / 能力 → 展示真实技能数据。"""
    ctx = runner.ctx
    skills = ctx.get("skills") or []
    abilities = ctx.get("abilities") or []
    report = ctx.get("latest_report") or {}
    target = (ctx.get("career_goal") or {}).get("target_job")
    blob = {
        "username": ctx.get("username"),
        "target_job": target,
        "skills": skills[:15],
        "abilities": abilities[:15],
        "latest_report": report,
    }
    lines = []
    if target:
        lines.append(f"你的目标岗位是「{target}」。")
    if skills:
        scored = [f"{s.get('skill_name')}({s.get('score') or '?'}分)" for s in skills[:10]]
        lines.append(f"技能库共 {len(skills)} 项，主要包括：{'、'.join(scored)}。")
    elif abilities:
        lines.append(f"你已填写能力问卷 {len(abilities)} 项。")
    if report:
        lines.append(f"最近职业报告综合分 {report.get('overall_score')}。")
    if not lines:
        lines.append("当前画像数据较少，建议先完善简历或填写能力问卷。")
    fallback = "；".join(lines)
    msg = _explain("profile", message, blob, fallback)
    return msg, _navigation_page("profile"), []


def _pipeline_resume_analyze(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    if not runner.ctx.get("current_resume_id"):
        return "你还没有上传简历，请先在「简历」页上传后再分析。", {"page": "resume"}, []
    r1 = runner.run("resume.get_text", {"resume_id": runner.ctx["current_resume_id"]}, "读取简历全文")
    if not r1["ok"]:
        return "无法读取简历：" + (r1.get("error") or {}).get("message", "未知原因"), {"page": "resume"}, []
    r2 = runner.run("resume.analyze", {"resume_id": runner.ctx["current_resume_id"]}, "AI 分析简历")
    if not r2["ok"]:
        return "简历分析暂不可用：" + (r2.get("error") or {}).get("message", "未知原因"), {"page": "resume"}, []
    analysis = r2["data"]
    blob = {
        "skills": analysis.get("skills") or [],
        "education": analysis.get("education") or {},
        "projects": (analysis.get("projects") or [])[:5],
        "advantages": (analysis.get("advantages") or [])[:5],
        "weaknesses": (analysis.get("weaknesses") or [])[:5],
        "overall_score": analysis.get("overall_score"),
    }
    skills = analysis.get("skills") or []
    lines = [f"你的简历共识别到 {len(skills)} 项技能："]
    lines.append("、".join(s.get("name", "?") for s in skills[:10]) or "（未识别到明显技能）")
    if analysis.get("overall_score"):
        lines.append(f"综合评分：{analysis['overall_score']}。")
    if analysis.get("weaknesses"):
        lines.append("主要不足：" + "、".join(str(w) for w in analysis["weaknesses"][:3]))
    fallback = "\n".join(lines)
    msg = _explain("resume_analyze", message, blob, fallback)
    return msg, _navigation_page("resume_analyze"), []


def _pipeline_resume_optimize(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    if not runner.ctx.get("current_resume_id"):
        return "你还没有上传简历，请先在「简历」页上传后再优化。", {"page": "resume"}, []
    r1 = runner.run("resume.get_text", {"resume_id": runner.ctx["current_resume_id"]}, "读取简历全文")
    if not r1["ok"]:
        return "无法读取简历。", {"page": "resume"}, []
    r2 = runner.run("resume.optimize", {"resume_id": runner.ctx["current_resume_id"], "mode": "professional"}, "生成简历优化建议")
    if not r2["ok"]:
        return "简历优化暂不可用：" + (r2.get("error") or {}).get("message", "未知原因"), {"page": "resume"}, []
    data = r2["data"]
    blob = {"mode": data.get("mode"), "summary": data.get("summary"), "skills": data.get("skills"),
            "projects": (data.get("projects") or [])[:5]}
    lines = []
    summary = data.get("summary") or {}
    if isinstance(summary, dict):
        if summary.get("optimized"):
            lines.append("简历优化建议已生成（仅建议，未写入数据库）。")
            lines.append(f"优化摘要：{str(summary.get('optimized'))[:120]}")
    if data.get("skills"):
        lines.append(f"技能部分建议优化 {len(data['skills'])} 处。")
    if not lines:
        lines.append("优化建议已生成，详见返回数据（仅建议，未写入数据库）。")
    fallback = "\n".join(lines)
    msg = _explain("resume_optimize", message, blob, fallback)
    return msg, _navigation_page("resume_optimize"), ["本工具仅生成优化建议，未修改你的简历"]


def _pipeline_job_search(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    keyword = _extract_job_keyword(message)
    if not keyword:
        return "请告诉我你想找什么岗位，例如「AI 产品经理」。", None, []
    r = runner.run("job.search", {"keyword": keyword, "limit": 10}, f"搜索岗位：{keyword}")
    if not r["ok"]:
        return "岗位搜索失败：" + (r.get("error") or {}).get("message", "未知原因"), {"page": "match"}, []
    jobs = r["data"].get("jobs") or []
    if not jobs:
        return f"岗位数据库中未找到与「{keyword}」匹配的岗位，请尝试换一个关键词。", {"page": "match"}, []
    blob = {"keyword": keyword, "total": r["data"].get("total"), "jobs": jobs[:10]}
    lines = [f"找到 {r['data'].get('total')} 条「{keyword}」相关岗位，示例："]
    for j in jobs[:5]:
        city = j.get("city") or ""
        lines.append(f"- {j.get('job_title')} @ {j.get('company_name')}（{city}）")
    fallback = "\n".join(lines)
    msg = _explain("job_search", message, blob, fallback)
    return msg, _navigation_page("job_search"), []


def _match_analysis(runner: _ToolRunner, job_id):
    """执行完整匹配链路，返回 (result, nav, error_message)。result 为 None 表示失败。"""
    ctx = runner.ctx
    if not ctx.get("current_resume_id") and not (ctx.get("skills") or []):
        return None, {"page": "match", "tab": "profile"}, "当前没有简历或技能数据，请先完善简历再分析匹配度。"
    profile, _meta = tools_mod.build_matching_profile(ctx, runner.user)
    runner.add_manual_step("构建候选人画像", "done", f"技能 {len(profile.get('skills') or [])} 项")

    jobs = None
    target = None
    if job_id is not None:
        rj = runner.run("job.get", {"job_id": job_id}, "获取目标岗位详情")
        if not rj["ok"]:
            return None, {"page": "match"}, "目标岗位不存在或已下线，无法分析。"
        job = rj["data"]
        jobs = [tools_mod_data_job(job)]
        target = job_id
    else:
        rj = runner.run("job.recall", {"profile": profile, "top_k": 50}, "召回候选岗位")
        if not rj["ok"] or not (rj["data"].get("jobs") or []):
            return None, {"page": "match"}, "暂未召回到合适的岗位，无法完成匹配分析。"
        jobs = rj["data"]["jobs"]
        target = None

    rm = runner.run("match.analyze", {"profile": profile, "jobs": jobs, "target_job_id": target}, "人岗匹配分析")
    if not rm["ok"]:
        return None, {"page": "match"}, "匹配分析暂不可用。"
    result = rm["data"]
    if not (result.get("matches") or []):
        return None, {"page": "match"}, "未得到有效的匹配结果，可能当前候选岗位不足。"
    nav = {"page": "match"}
    top = result["matches"][0]
    job = top.get("job") or {}
    if job.get("id") is not None:
        nav["query"] = {"job_id": job["id"]}
    return result, nav, ""


def tools_mod_data_job(job: dict) -> dict:
    """job.get 返回的总表字段 → matching.service 的岗位契约（对齐 to_match_job_dict）。"""
    detail = job.get("detail") or {}
    skills = detail.get("skills") or []
    preferred = list(dict.fromkeys(str(s) for s in ((detail.get("keywords") or []) + (detail.get("job_labels") or [])) if s))
    salary = None
    lo, hi = job.get("salary_min"), job.get("salary_max")
    if lo or hi:
        lo_k, hi_k = (lo or 0) // 1000, (hi or 0) // 1000
        salary = f"{lo_k}-{hi_k}K" if lo_k and hi_k else (f"{hi_k}K" if hi_k else None)
    return {
        "id": job.get("id"),
        "title": job.get("job_title"),
        "company": job.get("company_name"),
        "city": job.get("city"),
        "salary": salary,
        "required_skills": skills[:20],
        "preferred_skills": preferred[:20],
        "description": "\n".join(x for x in (detail.get("job_description"), detail.get("job_requirement")) if x),
        "source": job.get("source_name"),
        "source_url": detail.get("source_url"),
        "education": job.get("education"),
        "experience": job.get("experience"),
    }


def _pipeline_job_match(runner: _ToolRunner, message: str, job_id) -> tuple[str, dict, list[str]]:
    result, nav, error = _match_analysis(runner, job_id)
    if not result:
        return error or "匹配分析不可用。", nav, []
    matches = result["matches"]
    top = matches[0]
    job = top.get("job") or {}
    blob = {
        "match_score": top.get("score"),
        "dimensions": top.get("dimensions"),
        "matched": top.get("matched") or [],
        "missing": top.get("missing") or [],
        "job_title": job.get("title"),
        "company": job.get("company"),
        "top3": [
            {"title": (m.get("job") or {}).get("title"), "score": m.get("score")}
            for m in matches[:3]
        ],
    }
    lines = []
    if top.get("score") is not None:
        lines.append(f"与「{job.get('title')}」的匹配度为 {top['score']}。")
    if top.get("matched"):
        lines.append("主要优势：" + "、".join(str(s) for s in top["matched"][:6]))
    if top.get("missing"):
        lines.append("主要缺口：" + "、".join(str(s) for s in top["missing"][:6]))
    fallback = "\n".join(lines)
    msg = _explain("job_match", message, blob, fallback)
    return msg, nav, []


def _pipeline_skill_gap(runner: _ToolRunner, message: str, job_id) -> tuple[str, dict, list[str]]:
    result, nav, error = _match_analysis(runner, job_id)
    if not result:
        return error or "匹配分析不可用。", nav, []
    top = result["matches"][0]
    rg = runner.run("match.skill_gap", {"match": top}, "分析技能缺口")
    if not rg["ok"]:
        return "技能缺口分析失败：" + (rg.get("error") or {}).get("message", "未知原因"), nav, []
    gap = rg["data"]
    blob = {"missing": gap.get("missing") or [], "gaps": (gap.get("gaps") or [])[:6],
            "gap_paths": (gap.get("gap_paths") or [])[:6]}
    lines = []
    if gap.get("missing"):
        lines.append("与目标岗位相比，主要技能缺口：" + "、".join(str(s) for s in gap["missing"][:8]))
    if gap.get("gap_paths"):
        lines.append("可迁移路径：" + "；".join(
            f"{p.get('from')}→{p.get('to')}" for p in gap["gap_paths"][:4]))
    fallback = "\n".join(lines) or "暂未发现明显技能缺口。"
    msg = _explain("skill_gap", message, blob, fallback)
    return msg, nav, []


def _pipeline_what_if(runner: _ToolRunner, message: str, job_id) -> tuple[str, dict, list[str]]:
    ctx = runner.ctx
    if not ctx.get("current_resume_id") and not (ctx.get("skills") or []):
        return "缺少简历/技能数据，无法做 What-if 模拟。", {"page": "match"}, []
    candidates = [s.get("skill_name") for s in (ctx.get("skills") or [])]
    skill = _extract_skill(message, candidates) or _extract_skill_from_text(message)
    if not skill:
        return "请说明想提升的技能，例如「如果我把 Python 提升到 80 分呢」。", {"page": "match"}, []
    profile, _meta = tools_mod.build_matching_profile(ctx, runner.user)
    level = _extract_number(message) or 5
    r = runner.run("match.what_if", {"profile": profile, "skill": skill, "level": level}, f"What-if：提升 {skill}")
    if not r["ok"]:
        return "What-if 模拟失败。", {"page": "match"}, []
    data = r["data"]
    before = (data.get("before") or [])
    after = (data.get("after") or [])
    before_score = before[0].get("score") if before else None
    after_score = after[0].get("score") if after else None
    blob = {"skill": skill, "before_score": before_score, "after_score": after_score}
    fallback = (f"模拟提升「{skill}」后，匹配度由 {before_score} 提升至 {after_score}。"
                f"该结论为本地模拟，不改变真实简历。") if before_score is not None else "模拟结果暂不可用。"
    msg = _explain("what_if", message, blob, fallback)
    return msg, {"page": "match"}, ["What-if 为本地模拟结果，未修改任何数据"]


def _extract_skill_from_text(message: str) -> Optional[str]:
    m = re.search(r"([A-Za-z][A-Za-z0-9+#.]{1,30})", message or "")
    return m.group(1) if m else None


def _pipeline_career_evolution(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    title = _extract_job_keyword(message)
    if not title:
        return "请告诉我你想分析哪个岗位的能力演化，例如「产品经理」。", None, []
    re = runner.run("career.evolution", {"job_title": title}, f"分析「{title}」能力演化")
    if not re["ok"]:
        return "能力演化分析不可用。", {"page": "evolution"}, []
    data = re["data"]
    blob = {
        "job_title": data.get("job_title"),
        "hotSkills": (data.get("hotSkills") or [])[:10],
        "hotValues": (data.get("hotValues") or [])[:10],
        "added": (data.get("added") or [])[:8],
        "removed": (data.get("removed") or [])[:8],
        "data_source": data.get("data_source"),
    }
    lines = []
    if data.get("hotSkills"):
        lines.append(f"「{title}」当前热门技能：" + "、".join(str(s) for s in data["hotSkills"][:8]))
    if data.get("added"):
        lines.append("新增要求：" + "、".join(str(x.get("name")) for x in data["added"][:5]))
    if data.get("removed"):
        lines.append("弱化/淘汰：" + "、".join(str(x.get("name")) for x in data["removed"][:5]))
    if data.get("data_source") != "db":
        lines.append("（当前为演示/估计数据，非真实统计）")
    if not lines:
        lines.append(f"「{title}」暂无足够演化数据。")
    fallback = "\n".join(lines)
    msg = _explain("career_evolution", message, blob, fallback)
    return msg, {"page": "evolution", "query": {"job_id": title}}, (["演示数据，仅供参考"] if data.get("data_source") != "db" else [])


def _pipeline_career_forecast(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    title = _extract_job_keyword(message)
    if not title:
        return "请告诉我你想预测哪个岗位的发展，例如「产品经理」。", None, []
    rf = runner.run("career.forecast", {"job_title": title, "horizon": 6}, f"预测「{title}」趋势")
    if not rf["ok"]:
        return "趋势预测不可用。", {"page": "evolution"}, []
    data = rf["data"]
    forecast = data.get("forecast") or []
    blob = {"job_title": data.get("jobId") or title, "current": data.get("current"),
            "forecast": forecast, "method": data.get("method")}
    lines = []
    if data.get("current") is not None:
        lines.append(f"当前需求强度约 {data['current']}。")
    if forecast:
        head = forecast[0]
        lines.append(f"预计 1 个月后 {head.get('demand')}（区间 {head.get('low')}~{head.get('high')}）。")
    lines.append("（预测为模型估计 / Demo 数据，非真实统计）")
    fallback = "\n".join(lines)
    msg = _explain("career_forecast", message, blob, fallback)
    return msg, {"page": "evolution", "query": {"job_id": title}}, ["预测为模型估计 / Demo 数据"]


def _pipeline_job_discovery(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    rs = runner.run("discovery.scan", {}, "扫描新岗位")
    if not rs["ok"]:
        return "新岗位扫描失败：" + (rs.get("error") or {}).get("message", "未知原因"), {"page": "discovery"}, []
    data = rs["data"]
    discoveries = data.get("discoveries") or []
    forecasts = data.get("forecasts") or []
    blob = {"discoveries": discoveries[:10], "forecasts": forecasts[:5]}
    lines = []
    if discoveries:
        lines.append(f"本轮发现 {len(discoveries)} 个新兴岗位候选，Top：")
        for d in discoveries[:5]:
            lines.append(f"- {d.get('title')}（置信度 {d.get('confidence')}%）")
    else:
        lines.append("本轮未发现新的新兴岗位。")
    if forecasts:
        lines.append(f"未来方向预测 {len(forecasts)} 个（Demo）：" + "、".join(f.get("title") for f in forecasts[:3]))
    fallback = "\n".join(lines)
    msg = _explain("job_discovery", message, blob, fallback)
    return msg, {"page": "discovery"}, []


def _clean_query(message: str) -> str:
    """清洗提问中的语气词/疑问词，保留核心检索词。"""
    text = str(message or "").strip()
    for w in ("为什么", "什么是", "介绍一下", "介绍下", "介绍", "请帮我", "帮我", "解释一下",
              "相关知识", "有哪些", "怎么样", "呢", "吗", "？", "?", "。", "的岗位"):
        text = text.replace(w, "")
    return text.strip() or str(message or "").strip()


def _pipeline_knowledge(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    query = _clean_query(message) or "招聘"
    rk = runner.run("knowledge.ask", {"query": query, "top_k": 8}, "检索知识库并生成引用回答")
    if not rk["ok"]:
        return "知识库检索失败：" + (rk.get("error") or {}).get("message", "未知原因"), None, []
    data = rk["data"]
    runner.claims = data.get("claims") or []
    status = data.get("status")
    if status == "insufficient_evidence":
        runner.response_status = "insufficient_evidence"
        return (data.get("answer") or "知识库未检索到足够证据，无法可靠回答该问题。"), None, \
            data.get("warnings") or []
    return data.get("answer") or "", None, data.get("warnings") or []


def _pipeline_job_match_prep(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    """复合任务确定性 Pipeline：画像 → 召回 → 匹配 → 缺口 → 简历优化建议。"""
    ctx = runner.ctx
    if not ctx.get("current_resume_id") and not (ctx.get("skills") or []):
        return "当前没有简历或技能数据，请先完善简历。", {"page": "match", "tab": "profile"}, []

    profile, _meta = tools_mod.build_matching_profile(ctx, runner.user)
    runner.add_manual_step("构建候选人画像", "done", f"技能 {len(profile.get('skills') or [])} 项")

    rj = runner.run("job.recall", {"profile": profile, "top_k": 50}, "召回候选岗位")
    if not rj["ok"] or not (rj["data"].get("jobs") or []):
        return "未召回到合适岗位，无法完成「找岗 → 差距 → 改简历」流程。", {"page": "match"}, []
    jobs = rj["data"]["jobs"]

    rm = runner.run("match.analyze", {"profile": profile, "jobs": jobs}, "人岗匹配分析")
    if not rm["ok"]:
        return "匹配分析暂不可用。", {"page": "match"}, []
    result = rm["data"]
    matches = result.get("matches") or []
    if not matches:
        return "未得到有效匹配结果。", {"page": "match"}, []

    top = matches[0]
    job = top.get("job") or {}
    rg = runner.run("match.skill_gap", {"match": top}, "分析技能缺口")

    # 简历优化建议（GENERATE，不写库）
    ro = runner.run("resume.optimize", {"resume_id": ctx.get("current_resume_id"), "mode": "professional"},
                    "生成简历优化建议")
    optimize_ok = ro.get("ok")

    blob = {
        "top_job": {"title": job.get("title"), "company": job.get("company"), "score": top.get("score")},
        "matched": (top.get("matched") or [])[:8],
        "missing": (top.get("missing") or [])[:8],
        "optimize_generated": optimize_ok,
    }
    lines = []
    if top.get("score") is not None:
        lines.append(f"为你找到最匹配的岗位「{job.get('title')}」，匹配度 {top['score']}。")
    if top.get("matched"):
        lines.append("优势：" + "、".join(str(s) for s in top["matched"][:6]))
    if top.get("missing"):
        lines.append("差距：" + "、".join(str(s) for s in top["missing"][:6]))
    if optimize_ok:
        lines.append("已生成简历优化建议（仅建议，未写入数据库，需人工确认后应用）。")
    else:
        lines.append("简历优化建议暂不可用。")
    fallback = "\n".join(lines)
    msg = _explain("job_match_prep", message, blob, fallback)
    nav = {"page": "match", "query": {"job_id": job.get("id")}} if job.get("id") is not None else {"page": "match"}
    return msg, nav, ["简历优化仅为建议，未修改你的简历"]


def _pipeline_navigation(runner: _ToolRunner, message: str) -> tuple[str, dict, list[str]]:
    text = (message or "").lower()
    page = None
    if any(k in text for k in ("匹配", "岗位")):
        page = "match"
    elif any(k in text for k in ("发现", "扫描")):
        page = "discovery"
    elif any(k in text for k in ("演化", "洞察", "能力")):
        page = "evolution"
    elif any(k in text for k in ("简历",)):
        page = "resume"
    elif any(k in text for k in ("地图",)):
        page = "map"
    job_id = runner.ctx.get("current_job_id")
    nav = {"page": page or "match"}
    if job_id is not None:
        nav["query"] = {"job_id": job_id}
    return f"好的，已为你定位到「{nav['page']}」页面。", nav, []


# ============================================================
# 统一入口
# ============================================================
def run_agent(
    user: dict,
    message: str = "",
    *,
    page: Optional[str] = None,
    tab: Optional[str] = None,
    resume_id: Optional[int] = None,
    job_id: Optional[int] = None,
    conversation: Optional[list[dict]] = None,
) -> dict:
    """Global Agent 主入口（Phase 2，非流式）。

    user：get_current_user 返回的 {username, role}（user_id 以 Token 为准）。
    返回统一结构化 Response（message/status/intent/reasoning_summary/tool_calls/
    evidence/confidence/actions/navigation/warnings）。
    """
    ctx = ContextBuilder.build(
        user, page=page, tab=tab, resume_id=resume_id, job_id=job_id,
        conversation=conversation or [],
    )
    intent = classify_intent(message)
    runner = _ToolRunner(user, ctx)
    runner.add_manual_step("理解需求", "done", f"意图：{intent}")

    if intent == "navigation":
        msg, nav, warns = _pipeline_navigation(runner, message)
    elif intent == "resume_analyze":
        msg, nav, warns = _pipeline_resume_analyze(runner, message)
    elif intent == "resume_optimize":
        msg, nav, warns = _pipeline_resume_optimize(runner, message)
    elif intent == "job_search":
        msg, nav, warns = _pipeline_job_search(runner, message)
    elif intent == "job_match":
        msg, nav, warns = _pipeline_job_match(runner, message, job_id)
    elif intent == "skill_gap":
        msg, nav, warns = _pipeline_skill_gap(runner, message, job_id)
    elif intent == "what_if":
        msg, nav, warns = _pipeline_what_if(runner, message, job_id)
    elif intent == "career_evolution":
        msg, nav, warns = _pipeline_career_evolution(runner, message)
    elif intent == "career_forecast":
        msg, nav, warns = _pipeline_career_forecast(runner, message)
    elif intent == "job_discovery":
        msg, nav, warns = _pipeline_job_discovery(runner, message)
    elif intent == "knowledge":
        msg, nav, warns = _pipeline_knowledge(runner, message)
    elif intent == "job_match_prep":
        msg, nav, warns = _pipeline_job_match_prep(runner, message)
    else:  # profile
        msg, nav, warns = _pipeline_profile(runner, message)

    for w in warns or []:
        if w not in runner.warnings:
            runner.warnings.append(w)

    # ---- Evidence 规范化（统一结构 + 去重） ----
    normalized_evidence: list[dict] = []
    seen_keys: set = set()
    for raw_ev in runner.evidence:
        norm = ev_mod.normalize_evidence(raw_ev)
        key = (norm.get("type"), norm.get("evidence_id"))
        if key in seen_keys:
            continue
        seen_keys.add(key)
        normalized_evidence.append(norm)

    # ---- EvidenceValidator（确定性校验，不调用 LLM） ----
    validation = val_mod.validate_response({"claims": runner.claims}, normalized_evidence)
    for vw in validation.get("warnings") or []:
        if vw not in runner.warnings:
            runner.warnings.append(vw)
    if not validation["passed"] and runner.claims:
        if "部分生成内容无法与检索证据建立可靠对应关系。" not in runner.warnings:
            runner.warnings.append("部分生成内容无法与检索证据建立可靠对应关系。")

    # ---- Citations ----
    citations = []
    for e in normalized_evidence:
        citations.append({
            "evidence_id": e.get("evidence_id"),
            "title": e.get("title"),
            "source_name": e.get("source_name"),
            "source_url": e.get("source_url"),
            "location": e.get("location"),
        })

    confidence = validation.get("confidence") or _confidence(normalized_evidence)

    return {
        "message": msg,
        "status": runner.response_status,
        "intent": intent,
        "reasoning_summary": runner.steps,
        "tool_calls": runner.tool_calls,
        "evidence": normalized_evidence,
        "confidence": confidence,
        "validation": validation,
        "citations": citations,
        "actions": [],
        "navigation": nav,
        "warnings": runner.warnings,
    }
