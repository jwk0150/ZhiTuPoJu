# -*- coding: utf-8 -*-
"""Global Agent ContextBuilder —— 从真实数据库与当前请求组装统一 AI 上下文。

职责边界（Phase 1）：
- 只负责「只读组装」：读取 user_profiles / user_skills / user_abilities /
  tech_abilities / resumes / career_reports 等真实数据，输出压缩后的 ContextBundle。
- 禁止：调用 DeepSeek、做匹配计算、做 RAG、修改数据库、生成回答。
- 安全边界：完整简历原文 / interview_data 原文 / 密码 / token 一律不进 Prompt，
  只输出压缩摘要（完整内容由后续 resume.get_text 等 Tool 按需读取）。

数据来源基于项目真实 ORM Model（backend/models/user_profile.py、user_ability.py）。
"""
from __future__ import annotations

from typing import Any, Optional

from backend.db import SessionLocal
from backend.models.user_profile import CareerReport, Resume, UserProfile, UserSkill

# Phase 1 只开放只读/分析/生成；WRITE/DELETE 后续阶段经权限模型再开放
DEFAULT_TOOLS_SCOPE = ["READ", "ANALYZE", "GENERATE"]

MAX_SKILLS = 20
RESUME_PREVIEW_CHARS = 200
REPORT_SLOTS = 5
CONVERSATION_WINDOW = 8


def _compact_profile(profile: Optional[UserProfile]) -> Optional[dict]:
    """基本信息（user_profiles）—— 不含 bio/phone/email 等隐私明细。"""
    if not profile:
        return None
    return {
        "name": profile.name,
        "school": profile.school,
        "major": profile.major,
        "education": profile.education,
        "grade": profile.grade,
        "target_job": profile.target_job,
        "completion": profile.completion or 0,
    }


def _compact_skills(skills: list[UserSkill]) -> list[dict]:
    """技能列表（user_skills）—— 按 score 降序截断。"""
    rows = sorted(skills, key=lambda s: s.score or 0, reverse=True)[:MAX_SKILLS]
    return [
        {
            "skill_name": s.skill_name,
            "category": s.category,
            "level": s.level,
            "score": s.score,
            "source": s.source,
        }
        for s in rows
    ]


def _query_abilities(db, user_id: str) -> list[dict]:
    """能力问卷（user_abilities JOIN tech_abilities）。

    表可能尚未初始化（ability 路由惰性建表），失败时静默返回 []，不阻断。
    """
    try:
        from backend.models.user_ability import TechAbility, UserAbility

        rows = (
            db.query(TechAbility.name, TechAbility.category, TechAbility.frequency)
            .join(UserAbility, UserAbility.ability_id == TechAbility.id)
            .filter(UserAbility.user_id == user_id)
            .order_by(TechAbility.frequency.desc())
            .all()
        )
        return [
            {"name": r.name, "category": r.category, "frequency": r.frequency}
            for r in rows
        ]
    except Exception:
        return []


def _compact_resume(resume: Optional[Resume]) -> Optional[dict]:
    """最新简历（resumes）—— 只含元数据 + 文本预览，不含全文。"""
    if not resume:
        return None
    content = resume.content or ""
    return {
        "resume_id": resume.id,
        "filename": resume.filename,
        "file_type": resume.file_type,
        "status": resume.status,
        "text_length": len(content),
        "preview": content[:RESUME_PREVIEW_CHARS],
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
    }


def _compact_report(report: Optional[CareerReport]) -> Optional[dict]:
    """最新职业报告（career_reports）—— 六维分 + 优劣势摘要。"""
    if not report:
        return None
    return {
        "report_id": report.id,
        "overall_score": report.overall_score,
        "dimensions": {
            "tech": report.tech_score,
            "project": report.project_score,
            "data": report.data_score,
            "engineering": report.engineering_score,
            "innovation": report.innovation_score,
            "learning": report.learning_score,
        },
        "advantages": (report.advantages or [])[:REPORT_SLOTS],
        "weaknesses": (report.weaknesses or [])[:REPORT_SLOTS],
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _compact_career_goal(profile: Optional[UserProfile]) -> Optional[dict]:
    """职业目标 —— 组装自 target_job + interview_data 的压缩摘要。

    interview_data 仅取 basic_info / career_goal 的结构化摘要，不取原始对话内容。
    """
    if not profile:
        return None
    goal: dict[str, Any] = {"target_job": profile.target_job}
    iv = profile.interview_data
    if isinstance(iv, dict):
        basic = iv.get("basic_info") or {}
        career = iv.get("career_goal") or {}
        goal["interview_summary"] = {
            "school": basic.get("school") if isinstance(basic, dict) else None,
            "major": basic.get("major") if isinstance(basic, dict) else None,
            "target_jobs": (
                career.get("target_jobs") if isinstance(career, dict) else None
            ),
        }
    return goal


def build_context(
    user: dict,
    *,
    page: Optional[str] = None,
    tab: Optional[str] = None,
    resume_id: Optional[int] = None,
    job_id: Optional[int] = None,
    conversation: Optional[list[dict]] = None,
) -> dict:
    """组装 ContextBundle。

    user：get_current_user 返回的 {username, role}（user_id 即 username）。
    page/tab/resume_id/job_id/conversation：前端传入的页面上下文（可选）。
    任何真实数据库读取失败时降级为空数据，不抛错、不阻塞 Agent。
    """
    user_id = str(user.get("username") or "")
    profile: Optional[UserProfile] = None
    skills: list[UserSkill] = []
    abilities: list[dict] = []
    latest_resume: Optional[Resume] = None
    latest_report: Optional[CareerReport] = None

    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        skills = (
            db.query(UserSkill)
            .filter(UserSkill.user_id == user_id)
            .order_by(UserSkill.score.desc())
            .all()
        )
        abilities = _query_abilities(db, user_id)
        latest_resume = (
            db.query(Resume)
            .filter(Resume.user_id == user_id)
            .order_by(Resume.id.desc())
            .first()
        )
        latest_report = (
            db.query(CareerReport)
            .filter(CareerReport.user_id == user_id)
            .order_by(CareerReport.id.desc())
            .first()
        )
    except Exception:
        # 数据库不可用或表缺失：返回空上下文（后续调用方按无数据降级处理）
        profile = None
        skills = []
        abilities = []
        latest_resume = None
        latest_report = None
    finally:
        db.close()

    effective_resume_id = resume_id
    if effective_resume_id is None and latest_resume is not None:
        effective_resume_id = latest_resume.id

    return {
        "user_id": user_id,
        "username": user.get("username"),
        "role": user.get("role"),
        "current_page": page,
        "current_tab": tab,
        "current_resume_id": effective_resume_id,
        "current_job_id": job_id,
        "profile": _compact_profile(profile),
        "skills": _compact_skills(skills),
        "abilities": abilities,
        "latest_resume": _compact_resume(latest_resume),
        "latest_report": _compact_report(latest_report),
        "career_goal": _compact_career_goal(profile),
        "conversation": (conversation or [])[-CONVERSATION_WINDOW:],
        "tools_scope": DEFAULT_TOOLS_SCOPE,
        # 为后续「深度思考展示」保留接口（Phase 1 恒为空，不允许 LLM 编造）
        "reasoning_steps": [],
    }


class ContextBuilder:
    """Global Agent 上下文构建器（静态入口，保持模块级函数也可直接调用）。"""

    @staticmethod
    def build(user: dict, **kwargs) -> dict:
        return build_context(user, **kwargs)
