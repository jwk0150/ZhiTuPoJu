# -*- coding: utf-8 -*-
"""Global Agent Tool Registry —— 统一工具注册表（Phase 2）。

原则（延续项目 AGENTS.md 与 job_matching_agent.py 的职责边界）：
- Tool 只做：参数校验 / 调用现有 Service / 结果规范化 / 权限检查 / 错误捕获。
- Tool 禁止包含业务逻辑（不重算匹配、不重写召回、不重造解析）。
- 所有写权限（WRITE/DELETE）在 Phase 2 一律禁止注册执行，注册表会拦截。

Tool 统一输出结构：
    {"ok": true, "tool": "...", "data": {...}, "evidence": [...],
     "warnings": [...], "data_source": "db|mock|llm", "is_demo": false}
    {"ok": false, "tool": "...", "error": {"code": "...", "message": "..."}}
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from backend import data, profile_service
from backend.agent import evidence as ev_mod
from backend.agent.context import ContextBuilder
from backend.db import SessionLocal
from backend.evolution_agent import evolution_agent
from backend.knowledge.service import KnowledgeService
from backend.matching import service as ms
from backend.models.user_profile import Resume
from backend.routers import ability, career_evolution as ce, discovery


# ============================================================
# 通用工具函数
# ============================================================
def _ok(tool: str, data: Any, *, evidence: Optional[list] = None,
        warnings: Optional[list] = None, data_source: str = "db",
        is_demo: bool = False) -> dict:
    return {
        "ok": True,
        "tool": tool,
        "data": data,
        "evidence": evidence or [],
        "warnings": warnings or [],
        "data_source": data_source,
        "is_demo": is_demo,
    }


def _err(tool: str, code: str, message: str) -> dict:
    return {"ok": False, "tool": tool, "error": {"code": code, "message": message}}


def _load_resume_for_user(resume_id, user_id: str) -> Optional[Resume]:
    """按 id + user_id 读取简历；非本人或无权限返回 None（防越权）。"""
    if resume_id is None:
        return None
    db = SessionLocal()
    try:
        return (
            db.query(Resume)
            .filter(Resume.id == int(resume_id), Resume.user_id == user_id)
            .first()
        )
    except Exception:
        return None
    finally:
        db.close()


def _short(data: Any, limit: int = 120) -> str:
    try:
        text = __import__("json").dumps(data, ensure_ascii=False, default=str)
        return text[:limit] + ("..." if len(text) > limit else "")
    except Exception:
        return str(type(data).__name__)


def build_matching_profile(ctx: dict, user: dict) -> tuple[dict, dict]:
    """构造 matching.service 需要的候选人画像（真实解析优先，上下文兜底）。

    优先：最新简历 → matching.service.parse_resume（DeepSeek + 启发式兜底）。
    无有效简历：从 ContextBundle 的技能数据组装。
    """
    resume_id = ctx.get("current_resume_id")
    text = ""
    filename = "resume.txt"
    if resume_id:
        resume = _load_resume_for_user(resume_id, str(user.get("username") or ""))
        if resume and (resume.content or "").strip():
            text = resume.content
            filename = resume.filename or "resume.txt"

    if text and len(text.strip()) >= 30:
        profile, meta = ms.parse_resume(text, filename)
        return profile, meta

    profile_meta = ctx.get("profile") or {}
    skills = [
        {
            "name": s.get("skill_name"),
            "level": s.get("level") or "熟练",
            "evidence": "技能库记录",
            "confidence": 0.8,
        }
        for s in (ctx.get("skills") or [])
        if s.get("skill_name")
    ]
    return {
        "name": profile_meta.get("name") or ctx.get("username"),
        "target_role": profile_meta.get("target_job") or "",
        "city": "",
        "education": profile_meta.get("education") or "未识别",
        "experience_years": 0,
        "summary": "",
        "skills": skills,
        "projects": [],
        "confidence": 0.8,
        "source": "context",
        "filename": filename,
    }, {"llm": "none", "error": None}


# ============================================================
# Tool 实现
# ============================================================

# ---- context ----
def _context_get_current(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    if not ctx:
        ctx = ContextBuilder.build(
            user,
            page=params.get("page"),
            tab=params.get("tab"),
            resume_id=params.get("resume_id"),
            job_id=params.get("job_id"),
            conversation=params.get("conversation") or [],
        )
    return _ok("context.get_current", ctx, data_source="db")


# ---- resume ----
def _resume_list(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    user_id = str(user.get("username") or "")
    db = SessionLocal()
    try:
        rows = (
            db.query(Resume)
            .filter(Resume.user_id == user_id)
            .order_by(Resume.id.desc())
            .all()
        )
    except Exception:
        return _err("resume.list", "DB_ERROR", "简历数据读取失败")
    finally:
        db.close()
    resumes = [
        {
            "resume_id": r.id,
            "filename": r.filename,
            "file_type": r.file_type,
            "status": r.status,
            "text_length": len(r.content or ""),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return _ok("resume.list", {"resumes": resumes, "total": len(resumes)}, data_source="db")


def _resume_get_text(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    resume_id = params.get("resume_id") or (ctx or {}).get("current_resume_id")
    resume = _load_resume_for_user(resume_id, str(user.get("username") or ""))
    if not resume:
        return _err("resume.get_text", "RESUME_NOT_FOUND", "简历不存在或无权限访问")
    return _ok("resume.get_text", {
        "resume_id": resume.id,
        "filename": resume.filename,
        "file_type": resume.file_type,
        "status": resume.status,
        "text_length": len(resume.content or ""),
        "content": resume.content or "",
    }, data_source="db")


def _resume_analyze(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    resume_id = params.get("resume_id") or (ctx or {}).get("current_resume_id")
    resume = _load_resume_for_user(resume_id, str(user.get("username") or ""))
    if not resume:
        return _err("resume.analyze", "RESUME_NOT_FOUND", "简历不存在或无权限访问")
    result = profile_service.parse_resume_text(resume.content or "")
    if result.get("error"):
        return _err("resume.analyze", "AI_ERROR", str(result.get("error")))
    evidence = [
        {
            "type": "user_skill",
            "source_id": resume.id,
            "source_name": "简历分析",
            "content": f"{s.get('name')}（{s.get('level')}）" if s.get("name") else "",
            "relevance": float(s.get("confidence") or 0.5),
        }
        for s in (result.get("skills") or [])[:10]
    ]
    return _ok("resume.analyze", result, evidence=evidence, data_source="db")


def _resume_optimize(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    """只生成优化建议，不写数据库（profile_service.optimize_resume 为纯函数）。"""
    resume_id = params.get("resume_id") or (ctx or {}).get("current_resume_id")
    resume = _load_resume_for_user(resume_id, str(user.get("username") or ""))
    if not resume:
        return _err("resume.optimize", "RESUME_NOT_FOUND", "简历不存在或无权限访问")
    mode = params.get("mode") or "professional"
    analysis = params.get("analysis") or profile_service.parse_resume_text(resume.content or "")
    result = profile_service.optimize_resume(resume.content or "", analysis, mode)
    if result.get("fallback"):
        return _ok("resume.optimize", result, data_source="llm",
                   warnings=["模型暂不可用，已返回兜底结果"])
    if result.get("error"):
        return _err("resume.optimize", "AI_ERROR", str(result.get("error")))
    return _ok("resume.optimize", result, data_source="llm",
               warnings=["本工具仅生成优化建议，未写入数据库"])


# ---- job ----
def _job_search(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    keyword = str(params.get("keyword") or "").strip()
    limit = int(params.get("limit") or 20)
    jobs, total = data.get_real_jobs(limit=min(limit, 100), offset=0, keyword=keyword or None)
    return _ok("job.search", {"keyword": keyword, "total": total, "jobs": jobs},
               data_source="db")


def _job_get(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    job_id = params.get("job_id")
    if job_id is None:
        return _err("job.get", "MISSING_PARAM", "缺少 job_id")
    detail = data.get_real_job_detail(int(job_id))
    if not detail:
        return _err("job.get", "JOB_NOT_FOUND", "岗位不存在或已下线")
    evidence = [{
        "evidence_id": f"job_{detail.get('id')}",
        "type": "job",
        "source_id": detail.get("id"),
        "source_name": detail.get("source_name"),
        "content": f"{detail.get('job_title')} @ {detail.get('company_name')}",
        "source_url": (detail.get("detail") or {}).get("source_url"),
        "relevance": 1.0,
    }]
    return _ok("job.get", detail, evidence=evidence, data_source="db")


def _job_recall(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    profile = params.get("profile") or (params.get("profile") if "profile" in params else None)
    if not profile:
        profile, _meta = build_matching_profile(ctx or {}, user)
    top_k = int(params.get("top_k") or 50)
    try:
        jobs = ms.retrieve_candidate_jobs(profile, top_k=top_k,
                                          target_job_id=params.get("target_job_id"))
    except Exception as exc:  # noqa: BLE001
        return _err("job.recall", "RECALL_ERROR", f"岗位召回失败：{exc}")
    return _ok("job.recall", {"jobs": jobs, "profile": profile}, data_source="db")


# ---- match ----
def _match_analyze(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    profile = params.get("profile")
    if not profile:
        profile, _meta = build_matching_profile(ctx or {}, user)
    jobs = params.get("jobs")
    if jobs is None:
        jobs = ms.retrieve_candidate_jobs(profile, top_k=int(params.get("top_k") or 50))
    target_job_id = params.get("target_job_id")
    result = ms.diagnose_from_profile(
        profile,
        jobs or [],
        target_job_id=target_job_id,
        mode="b",
        parse_meta={"llm": "none", "error": None},
        document={},
    )
    evidence = []
    for m in (result.get("matches") or []):
        for ev in (m.get("evidence") or []):
            evidence.append({
                "evidence_id": ev.get("evidence_id"),
                "type": "job_match",
                "source_id": (m.get("job") or {}).get("id"),
                "source_name": ev.get("source_name") or (m.get("job") or {}).get("source"),
                "content": (ev.get("snippet") or "")[:200],
                "source_url": ev.get("source_url"),
                "relevance": ev.get("score"),
            })
    return _ok("match.analyze", result, evidence=evidence[:20], data_source="db")


def _match_skill_gap(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    match = params.get("match")
    if not match:
        diag = params.get("diagnose_result") or {}
        matches = diag.get("matches") or []
        if matches:
            match = matches[0]
    if not match:
        return _err("match.skill_gap", "NO_MATCH", "缺少匹配结果，请先执行 match.analyze")
    gap = {
        "matched": match.get("matched") or [],
        "missing": match.get("missing") or [],
        "gaps": match.get("gaps") or [],
        "gap_paths": match.get("gap_paths") or [],
        "dimensions": match.get("dimensions") or {},
    }
    return _ok("match.skill_gap", gap, data_source="db")


def _match_learning_path(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    match = params.get("match")
    if not match:
        diag = params.get("diagnose_result") or {}
        matches = diag.get("matches") or []
        if matches:
            match = matches[0]
    if not match:
        return _err("match.learning_path", "NO_MATCH", "缺少匹配结果，请先执行 match.analyze")
    path = ms.build_learning_path(match)
    return _ok("match.learning_path", {"learning_path": path}, data_source="db")


def _match_what_if(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    skill = str(params.get("skill") or "").strip()
    if not skill:
        return _err("match.what_if", "MISSING_PARAM", "请说明要提升的技能")
    profile = params.get("profile")
    if not profile:
        profile, _meta = build_matching_profile(ctx or {}, user)
    jobs = params.get("jobs")
    if jobs is None:
        jobs = ms.retrieve_candidate_jobs(profile, top_k=50)
    try:
        from backend.llm.job_matching_agent import JobMatchingTools
        result = JobMatchingTools().what_if_match(profile, jobs or [], skill,
                                                  level=int(params.get("level") or 5))
    except Exception as exc:  # noqa: BLE001
        return _err("match.what_if", "WHAT_IF_ERROR", f"What-if 模拟失败：{exc}")
    return _ok("match.what_if", result, data_source="db")


# ---- skill ----
def _skill_get_user(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    username = str(user.get("username") or "")
    try:
        result = ability.get_user_abilities(username)
    except Exception as exc:  # noqa: BLE001
        return _err("skill.get_user", "SKILL_ERROR", f"能力数据读取失败：{exc}")
    data = result.get("data") or {}
    return _ok("skill.get_user", data, data_source="db")


def _skill_catalog(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    try:
        data = ability._load_tech_catalog()  # noqa: SLF001
    except Exception as exc:  # noqa: BLE001
        return _err("skill.catalog", "CATALOG_ERROR", f"技术目录读取失败：{exc}")
    return _ok("skill.catalog", data, data_source="db")


# ---- career ----
def _career_evolution(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    title = str(params.get("job_title") or params.get("job_id") or "").strip()
    if not title:
        return _err("career.evolution", "MISSING_PARAM", "请指定要分析的岗位")
    result = evolution_agent.analyze_job_evolution(title)
    is_demo = result.get("data_source") != "db"
    evidence = ([ev_mod.from_tool_result("career.evolution", result,
                                         data_source=result.get("data_source") or "mock",
                                         is_demo=True)]
                if is_demo else [])
    return _ok("career.evolution", result,
               evidence=evidence,
               data_source=result.get("data_source") or "mock", is_demo=is_demo,
               warnings=["当前为演示/估计数据，非真实统计"] if is_demo else [])


def _career_snapshot(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    job_id = str(params.get("job_id") or params.get("job_title") or "").strip()
    if not job_id:
        return _err("career.snapshot", "MISSING_PARAM", "请指定要分析的岗位")
    version = str(params.get("version") or "V2026.08")
    result = ce.get_snapshot(job_id, version=version)
    data = result.get("data") or {}
    is_demo = data.get("dataSource") != "db"
    evidence = ([ev_mod.from_tool_result("career.snapshot", data,
                                         data_source=data.get("dataSource") or "mock",
                                         is_demo=True)]
                if is_demo else [])
    return _ok("career.snapshot", data,
               evidence=evidence,
               data_source=data.get("dataSource") or "mock", is_demo=is_demo,
               warnings=["演示数据"] if is_demo else [])


def _career_forecast(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    job_id = str(params.get("job_id") or params.get("job_title") or "").strip()
    if not job_id:
        return _err("career.forecast", "MISSING_PARAM", "请指定要预测的岗位")
    skill = str(params.get("skill") or "ai-coding")
    try:
        horizon = min(max(int(params.get("horizon") or 6), 1), 6)
    except (TypeError, ValueError):
        horizon = 6
    result = ce.get_forecast(job_id, skill=skill, horizon=horizon)
    data = result.get("data") or {}
    evidence = [ev_mod.from_tool_result("career.forecast", data,
                                        data_source="mock", is_demo=True)]
    return _ok("career.forecast", data,
               evidence=evidence,
               data_source="mock", is_demo=True,
               warnings=["预测为模型估计/Demo 数据，非真实统计"])


# ---- discovery ----
def _discovery_scan(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    try:
        result = discovery.AGENT.scan_with_reasoning()
    except Exception as exc:  # noqa: BLE001
        return _err("discovery.scan", "SCAN_ERROR", f"岗位扫描失败：{exc}")
    discoveries = result.get("discoveries") or []
    forecasts = result.get("forecasts") or []
    evidence = []
    for d in discoveries[:10]:
        for src in (d.get("evidence_sources") or [])[:3]:
            evidence.append({
                "type": "job_evidence",
                "source_id": d.get("id"),
                "source_name": src.get("source_name"),
                "content": f"{d.get('title')} — {src.get('company')}（{src.get('city')}）",
                "relevance": (d.get("confidence") or 0) / 100.0,
            })
    return _ok("discovery.scan", {
        "discoveries": discoveries[:20],
        "forecasts": forecasts[:10],
        "reasoning_chain": result.get("reasoning_chain") or [],
        "stats": result.get("stats") or {},
    }, evidence=evidence[:20], data_source="db" if discoveries else "mock",
        is_demo=not discoveries)


# ---- knowledge ----
def _knowledge_ask(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    """检索 + Evidence + Grounded Generation（ResearchAgent，薄封装）。"""
    from backend.agent.research_agent import ResearchAgent

    query = str(params.get("query") or "").strip()
    if not query:
        return _err("knowledge.ask", "MISSING_PARAM", "缺少检索语句")
    try:
        result = ResearchAgent().ask(
            query,
            filters=params.get("filters") or {},
            top_k=int(params.get("top_k") or 10),
        )
    except Exception as exc:  # noqa: BLE001
        return _err("knowledge.ask", "RAG_ERROR", f"知识库问答失败：{exc}")
    evidence = result.get("evidence") or []
    warnings = result.get("warnings") or []
    if result.get("status") == "insufficient_evidence":
        warnings = warnings or ["知识库未检索到足够相关内容"]
    return _ok("knowledge.ask", result, evidence=evidence, warnings=warnings,
               data_source="db")


def _knowledge_search(user: dict, params: dict, ctx: Optional[dict]) -> dict:
    query = str(params.get("query") or "").strip()
    if not query:
        return _err("knowledge.search", "MISSING_PARAM", "缺少检索语句")
    top_k = int(params.get("top_k") or 10)
    filters = params.get("filters") or {}
    try:
        res = KnowledgeService().search(query, filters=filters, top_k=top_k)
    except Exception as exc:  # noqa: BLE001
        return _err("knowledge.search", "RAG_ERROR", f"知识库检索失败：{exc}")
    status = res.get("status") or "INSUFFICIENT_EVIDENCE"
    results = res.get("results") or []
    if status != "OK" or not results:
        return _ok("knowledge.search", {"status": "INSUFFICIENT_EVIDENCE", "results": []},
                   data_source="db", warnings=["知识库未检索到足够相关内容"])
    evidence = [
        {
            "type": "knowledge_chunk",
            "source_id": h.get("doc_id"),
            "source_name": h.get("source_name"),
            "content": (h.get("snippet") or "")[:200],
            "source_url": h.get("source_url"),
            "relevance": h.get("final_score"),
        }
        for h in results[:10]
    ]
    return _ok("knowledge.search", {"status": "OK", "results": results},
               evidence=evidence, data_source="db")


# ============================================================
# 注册表
# ============================================================
def _reg(name: str, permission: str, description: str, handler: Callable) -> dict:
    return {"name": name, "permission": permission, "description": description,
            "handler": handler}


TOOL_REGISTRY: dict[str, dict] = {
    "context.get_current": _reg("context.get_current", "READ", "获取当前用户统一上下文", _context_get_current),
    "resume.list": _reg("resume.list", "READ", "列出当前用户简历", _resume_list),
    "resume.get_text": _reg("resume.get_text", "READ", "读取简历全文", _resume_get_text),
    "resume.analyze": _reg("resume.analyze", "ANALYZE", "AI 分析简历", _resume_analyze),
    "resume.optimize": _reg("resume.optimize", "GENERATE", "生成简历优化建议（不写库）", _resume_optimize),
    "job.search": _reg("job.search", "READ", "按关键词搜索真实岗位", _job_search),
    "job.get": _reg("job.get", "READ", "获取岗位详情", _job_get),
    "job.recall": _reg("job.recall", "ANALYZE", "按候选人画像召回岗位", _job_recall),
    "match.analyze": _reg("match.analyze", "ANALYZE", "人岗匹配五维分析", _match_analyze),
    "match.skill_gap": _reg("match.skill_gap", "ANALYZE", "分析技能缺口", _match_skill_gap),
    "match.learning_path": _reg("match.learning_path", "GENERATE", "生成学习路径", _match_learning_path),
    "match.what_if": _reg("match.what_if", "ANALYZE", "模拟提升技能后的匹配变化", _match_what_if),
    "skill.get_user": _reg("skill.get_user", "READ", "读取用户能力问卷", _skill_get_user),
    "skill.catalog": _reg("skill.catalog", "READ", "读取技术能力目录", _skill_catalog),
    "career.evolution": _reg("career.evolution", "ANALYZE", "岗位能力演化分析", _career_evolution),
    "career.snapshot": _reg("career.snapshot", "ANALYZE", "能力版本快照", _career_snapshot),
    "career.forecast": _reg("career.forecast", "ANALYZE", "能力趋势预测（Demo）", _career_forecast),
    "discovery.scan": _reg("discovery.scan", "ANALYZE", "新岗位发现扫描", _discovery_scan),
    "knowledge.search": _reg("knowledge.search", "READ", "知识库混合检索", _knowledge_search),
    "knowledge.ask": _reg("knowledge.ask", "ANALYZE", "知识库检索 + 证据 + 引用回答（RAG）", _knowledge_ask),
}

WRITE_PERMISSIONS = {"WRITE", "DELETE"}


def get_tool(name: str) -> Optional[dict]:
    return TOOL_REGISTRY.get(name)


def list_tools() -> list[dict]:
    return [
        {"name": t["name"], "permission": t["permission"], "description": t["description"]}
        for t in TOOL_REGISTRY.values()
    ]


def is_write_tool(name: str) -> bool:
    tool = TOOL_REGISTRY.get(name)
    return bool(tool and tool["permission"] in WRITE_PERMISSIONS)
