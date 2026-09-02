# -*- coding: utf-8 -*-
"""用户中心 — FastAPI Router
提供：个人资料 CRUD、简历上传/解析、AI 职业访谈、职业画像分析
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.db import SessionLocal
from backend.models.user_profile import CareerReport, Resume, UserFavorite, UserProfile, UserSkill
from backend.routers.auth import get_current_user
from backend import profile_service

router = APIRouter(tags=["user-profile"])

# 上传目录
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# Pydantic Schemas
# ============================================================


class ProfileUpdate(BaseModel):
    user_id: str
    name: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    education: Optional[str] = None
    grade: Optional[str] = None
    target_job: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class InterviewRequest(BaseModel):
    user_id: str
    history: list[dict] = []
    message: str = ""


class InterviewStartRequest(BaseModel):
    user_id: str


class ResumeSyncRequest(BaseModel):
    filename: Optional[str] = None
    source: str = "resume-builder"
    content: str = ""
    metadata: dict = {}


class FavoriteToggleRequest(BaseModel):
    source: str
    item_id: str
    title: Optional[str] = None
    payload: dict = {}


# ============================================================
# 1. 获取个人资料
# ============================================================


@router.get("/profile/{user_id}")
def get_profile(user_id: str):
    """获取用户完整资料：基本信息 + 技能 + 最新报告"""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        skills = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
        latest_report = (
            db.query(CareerReport)
            .filter(CareerReport.user_id == user_id)
            .order_by(CareerReport.id.desc())
            .first()
        )

        return {
            "code": 0,
            "message": "success",
            "data": {
                "profile": _profile_to_dict(profile),
                "skills": [_skill_to_dict(s) for s in skills],
                "report": _report_to_dict(latest_report) if latest_report else None,
            },
        }
    finally:
        db.close()


@router.get("/profile/{user_id}/skills")
def get_user_skills(user_id: str):
    """获取用户技能列表"""
    db = SessionLocal()
    try:
        skills = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
        return {"code": 0, "message": "success", "data": {"skills": [_skill_to_dict(s) for s in skills]}}
    finally:
        db.close()


# ============================================================
# 2. 更新个人资料
# ============================================================


@router.post("/profile/update")
def update_profile(body: ProfileUpdate):
    """创建或更新个人资料"""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == body.user_id).first()

        if not profile:
            profile = UserProfile(user_id=body.user_id)
            db.add(profile)

        # 更新非空字段
        for field in ["name", "school", "major", "education", "grade", "target_job", "bio", "phone", "email"]:
            val = getattr(body, field)
            if val is not None:
                setattr(profile, field, val)

        # 计算完成度
        filled = sum(
            1
            for f in ["name", "school", "major", "education", "target_job"]
            if getattr(profile, f)
        )
        profile.completion = min(100, filled * 20)

        profile.updated_at = datetime.now()
        db.commit()
        db.refresh(profile)

        return {"code": 0, "message": "保存成功", "data": {"profile": _profile_to_dict(profile)}}
    finally:
        db.close()


# ============================================================
# 3. 简历上传
# ============================================================


@router.post("/resume/upload")
async def upload_resume(user_id: str = Form(...), file: UploadFile = File(...)):
    """上传简历文件，保存到本地并提取文本"""
    # 校验扩展名
    ext = Path(file.filename or "unknown").suffix.lower()
    if ext not in (".pdf", ".doc", ".docx", ".txt"):
        raise HTTPException(400, "仅支持 PDF / Word / TXT 格式")

    # 保存文件
    safe_name = f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
    dest = UPLOAD_DIR / safe_name
    with open(dest, "wb") as f:
        content_bytes = await file.read()
        f.write(content_bytes)

    # 提取文本
    text = profile_service.extract_resume_text(str(dest), ext)

    # 入库
    db = SessionLocal()
    try:
        resume = Resume(
            user_id=user_id,
            filename=file.filename,
            filepath=str(dest),
            file_type=ext.lstrip("."),
            content=text[:50000],
            status="uploaded",
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)

        return {
            "code": 0,
            "message": "上传成功",
            "data": {
                "resume_id": resume.id,
                "filename": resume.filename,
                "text_length": len(text),
                "text_preview": text[:300],
            },
        }
    finally:
        db.close()


# ============================================================
# 4. 简历 AI 分析
# ============================================================


@router.post("/resume/analyze/{resume_id}")
def analyze_resume(resume_id: int):
    """对已上传的简历进行 AI 解析"""
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise HTTPException(404, "简历不存在")
        if not resume.content or not resume.content.strip():
            raise HTTPException(400, "简历内容为空，请重新上传")

        # 调用 AI 解析
        result = profile_service.parse_resume_text(resume.content)

        if result.get("error"):
            resume.status = "error"
            db.commit()
            return {"code": 1, "message": result["error"], "data": None}

        # 保存技能
        skills_data = result.get("skills", [])
        profile_service.save_skills_from_parse(resume.user_id, skills_data, source="resume")

        # 更新简历状态
        resume.status = "analyzed"
        resume.updated_at = datetime.now()
        db.commit()

        # 自动更新用户资料中的教育信息
        edu = result.get("education", {})
        if edu:
            profile = db.query(UserProfile).filter(UserProfile.user_id == resume.user_id).first()
            if profile:
                if edu.get("school") and not profile.school:
                    profile.school = edu["school"]
                if edu.get("major") and not profile.major:
                    profile.major = edu["major"]
                if edu.get("degree") and not profile.education:
                    profile.education = edu["degree"]
                profile.updated_at = datetime.now()
                db.commit()

        return {
            "code": 0,
            "message": "分析完成",
            "data": {
                "education": edu,
                "skills": skills_data,
                "projects": result.get("projects", []),
                "advantages": result.get("advantages", []),
                "weaknesses": result.get("weaknesses", []),
                "overall_score": result.get("overall_score", 0),
            },
        }
    finally:
        db.close()


# ============================================================
# 5. AI 职业访谈
# ============================================================


@router.post("/interview/start")
def start_interview(body: InterviewStartRequest):
    """开始新的 AI 职业访谈"""
    result = profile_service.start_interview()
    return {"code": 0, "message": "success", "data": result}


@router.post("/interview/chat")
def interview_chat(body: InterviewRequest):
    """继续 AI 职业访谈对话"""
    result = profile_service.run_career_interview(body.history, body.message)

    # 如果访谈完成，保存画像 + 生成简历 + 运行职业分析
    if result.get("is_complete") and result.get("profile_data"):
        pd = result["profile_data"]
        db = SessionLocal()
        try:
            # 更新/创建用户资料
            profile = db.query(UserProfile).filter(UserProfile.user_id == body.user_id).first()
            if not profile:
                profile = UserProfile(user_id=body.user_id)
                db.add(profile)

            basic = pd.get("basic_info", {})
            edu = pd.get("education", {})
            career = pd.get("career_goal", {})

            if basic.get("school"):
                profile.school = basic["school"]
            if basic.get("major"):
                profile.major = basic["major"]
            if basic.get("education"):
                profile.education = basic["education"]
            if basic.get("name"):
                profile.name = basic["name"]
            if basic.get("grade"):
                profile.grade = basic["grade"]

            target = career.get("target_jobs", [])
            if isinstance(target, list) and len(target) > 0:
                profile.target_job = target[0]
            elif isinstance(target, str) and target:
                profile.target_job = target
            elif pd.get("target_job"):
                profile.target_job = pd["target_job"]

            profile.updated_at = datetime.now()
            profile.completion = min(100, profile.completion + 40)

            # 保存技能
            skills_data = pd.get("skills", [])
            normalized_skills = []
            cat_map = {"编程语言":"编程语言","框架":"框架","工具":"工具","数据分析":"领域知识","AI":"领域知识","机器学习":"领域知识","数据库":"工具","办公":"工具"}
            for s in (skills_data or []):
                name = s.get("name", "")
                cat = s.get("category", "")
                if not cat and name:
                    for kw, c in cat_map.items():
                        if kw in name:
                            cat = c
                            break
                    if not cat:
                        cat = "领域知识"
                normalized_skills.append({
                    "name": name,
                    "category": cat,
                    "level": s.get("level", "熟练"),
                    "score": 70 if s.get("confidence") == "confirmed" else (50 if s.get("confidence") == "self_assessed" else 40),
                    "source": "interview"
                })
            profile_service.save_skills_from_parse(body.user_id, normalized_skills, source="interview")
            profile.interview_data = pd
            db.commit()
        finally:
            db.close()

        # 自动生成简历
        resume_text = profile_service.generate_resume_from_profile(pd)
        # 保存生成的简历到数据库
        db2 = SessionLocal()
        try:
            gen_resume = Resume(
                user_id=body.user_id,
                filename=f"AI生成简历_{basic.get('name', '用户')}_{datetime.now().strftime('%Y%m%d')}.md",
                filepath="",
                file_type="md",
                content=resume_text[:50000],
                status="generated",
            )
            db2.add(gen_resume)
            db2.commit()
            db2.refresh(gen_resume)
            result["generated_resume_id"] = gen_resume.id
            result["generated_resume"] = resume_text[:3000]
        finally:
            db2.close()

        # 自动运行职业画像分析
        try:
            skills_for_radar = [
                {"name": s["name"], "category": s.get("category", "领域知识"), "level": s.get("level", "熟练"), "score": s.get("score", 50)}
                for s in normalized_skills
            ]
            radar = profile_service.build_radar_data(skills_for_radar)
            match_jobs = profile_service.calculate_job_match(skills_for_radar, top_n=10)
            profile_service.save_career_report(
                user_id=body.user_id,
                skills=skills_for_radar,
                radar_data=radar,
                advantages=pd.get("personal_strengths", [])[:5],
                weaknesses=pd.get("missing_information", [])[:5],
                suggestions=[],
                match_jobs=match_jobs,
                raw_analysis=pd,
            )
            result["career_analysis_ready"] = True
        except Exception as e:
            result["career_analysis_ready"] = False
            result["analysis_error"] = str(e)

    return {"code": 0, "message": "success", "data": result}


# ============================================================
# 6. 职业画像分析
# ============================================================


@router.post("/career/analyze/{user_id}")
def run_career_analysis(user_id: str):
    """运行完整职业画像分析：雷达图 + 岗位匹配 + 生成报告"""
    db = SessionLocal()
    try:
        skills = db.query(UserSkill).filter(UserSkill.user_id == user_id).order_by(UserSkill.score.desc()).all()
        # 去重：同一技能名保留最高分
        seen = {}
        for s in skills:
            name = s.skill_name.lower()
            if name not in seen or (s.score or 0) > (seen[name].score or 0):
                seen[name] = s
        skills_data = [_skill_to_dict(s) for s in seen.values()]

        if not skills_data:
            return {"code": 1, "message": "暂无技能数据，请先上传简历或完成AI访谈", "data": None}

        # 计算雷达图
        radar = profile_service.build_radar_data(skills_data)

        # 岗位匹配
        match_jobs = profile_service.calculate_job_match(skills_data, top_n=10)

        # AI 生成优势和不足
        advantages = []
        weaknesses = []
        suggestions = []
        try:
            analysis_prompt = f"""根据以下用户技能数据，分析其职业优势、不足和成长建议。
技能列表：{json.dumps(skills_data, ensure_ascii=False)}

输出 JSON：
{{
  "advantages": ["3-4个具体优势"],
  "weaknesses": ["2-3个具体不足"],
  "suggestions": ["3-5条可操作的成长建议"]
}}"""
            content, meta = deepseek.chat_completions(
                [{"role": "user", "content": analysis_prompt}], temperature=0.3, timeout=45.0
            )
            if not meta.get("error"):
                analysis = deepseek._extract_json(content)
                advantages = analysis.get("advantages", [])
                weaknesses = analysis.get("weaknesses", [])
                suggestions = analysis.get("suggestions", [])
        except Exception:
            pass

        # 保存报告
        report = profile_service.save_career_report(
            user_id=user_id,
            skills=skills_data,
            radar_data=radar,
            advantages=advantages,
            weaknesses=weaknesses,
            suggestions=suggestions,
            match_jobs=match_jobs,
            raw_analysis={"skills": skills_data, "radar": radar},
        )

        return {
            "code": 0,
            "message": "分析完成",
            "data": {
                "report": _report_to_dict(report),
                "radar": radar,
                "match_jobs": match_jobs,
                "advantages": advantages,
                "weaknesses": weaknesses,
                "suggestions": suggestions,
            },
        }
    finally:
        db.close()


# ============================================================
# 7. 获取报告
# ============================================================


@router.get("/career/report/{user_id}")
def get_latest_report(user_id: str):
    """获取用户最新的职业分析报告"""
    db = SessionLocal()
    try:
        report = (
            db.query(CareerReport)
            .filter(CareerReport.user_id == user_id)
            .order_by(CareerReport.id.desc())
            .first()
        )
        if not report:
            return {"code": 1, "message": "暂无分析报告，请先运行分析", "data": None}

        skills = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()

        return {
            "code": 0,
            "message": "success",
            "data": {
                "report": _report_to_dict(report),
                "skills": [_skill_to_dict(s) for s in skills],
                "radar": profile_service.build_radar_data([_skill_to_dict(s) for s in skills]),
            },
        }
    finally:
        db.close()


@router.get("/career/job-matches/{user_id}")
def get_job_matches(user_id: str):
    """获取用户岗位匹配结果（实时计算）"""
    db = SessionLocal()
    try:
        skills = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
        skills_data = [_skill_to_dict(s) for s in skills]
        if not skills_data:
            return {"code": 1, "message": "暂无技能数据", "data": {"matches": []}}

        matches = profile_service.calculate_job_match(skills_data, top_n=10)
        return {"code": 0, "message": "success", "data": {"matches": matches}}
    finally:
        db.close()


# ============================================================
# 8. 获取简历列表
# ============================================================


@router.get("/resumes/{user_id}")
def get_resumes(user_id: str):
    """获取用户简历列表"""
    db = SessionLocal()
    try:
        resumes = (
            db.query(Resume)
            .filter(Resume.user_id == user_id)
            .order_by(Resume.created_at.desc())
            .all()
        )
        return {
            "code": 0,
            "message": "success",
            "data": {
                "resumes": [
                    {
                        "id": r.id,
                        "filename": r.filename,
                        "file_type": r.file_type,
                        "status": r.status,
                        "text_length": len(r.content or ""),
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in resumes
                ]
            },
        }
    finally:
        db.close()


@router.get("/resumes")
def get_my_resumes(current_user: dict = Depends(get_current_user)):
    """读取当前登录用户的简历，避免由前端传入 user_id 越权。"""
    return get_resumes(current_user["username"])


@router.post("/resumes/sync")
def sync_resume(body: ResumeSyncRequest, current_user: dict = Depends(get_current_user)):
    """将简历探索结果同步到个人仓库数据库。每个文件名保留最新版本。"""
    content = (body.content or "")[:100000]
    if not content.strip():
        raise HTTPException(400, "简历内容不能为空")
    user_id = current_user["username"]
    filename = body.filename or "未命名简历.txt"
    db = SessionLocal()
    try:
        resume = (
            db.query(Resume)
            .filter(Resume.user_id == user_id, Resume.filename == filename)
            .order_by(Resume.id.desc())
            .first()
        )
        if resume is None:
            resume = Resume(user_id=user_id, filename=filename, file_type="txt")
            db.add(resume)
        resume.content = content
        resume.extra_metadata = body.metadata or {"source": body.source}
        resume.filepath = ""
        resume.file_type = (filename.rsplit(".", 1)[-1] if "." in filename else "txt")[:16]
        resume.status = "generated" if body.source == "resume-builder" else "synced"
        resume.updated_at = datetime.now()
        if resume.created_at is None:
            resume.created_at = datetime.now()
        db.commit()
        db.refresh(resume)
        return {"code": 0, "message": "简历已入库", "data": {"resume_id": resume.id, "filename": resume.filename}}
    finally:
        db.close()


@router.get("/favorites")
def get_my_favorites(source: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        q = db.query(UserFavorite).filter(UserFavorite.user_id == current_user["username"])
        if source:
            q = q.filter(UserFavorite.source == source)
        rows = q.order_by(UserFavorite.created_at.desc(), UserFavorite.id.desc()).all()
        return {"code": 0, "message": "success", "data": {"favorites": [
            {"id": r.item_id, "source": r.source, "title": r.title, "payload": r.payload,
             "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in rows
        ]}}
    finally:
        db.close()


@router.post("/favorites/toggle")
def toggle_favorite(body: FavoriteToggleRequest, current_user: dict = Depends(get_current_user)):
    if body.source not in {"news", "discovery", "forecast", "match"}:
        raise HTTPException(400, "不支持的收藏类型")
    db = SessionLocal()
    try:
        user_id = current_user["username"]
        row = db.query(UserFavorite).filter(
            UserFavorite.user_id == user_id,
            UserFavorite.source == body.source,
            UserFavorite.item_id == str(body.item_id),
        ).first()
        if row:
            db.delete(row)
            db.commit()
            return {"code": 0, "message": "已取消收藏", "data": {"added": False}}
        row = UserFavorite(user_id=user_id, source=body.source, item_id=str(body.item_id),
                           title=body.title, payload=body.payload or {}, created_at=datetime.now(), updated_at=datetime.now())
        db.add(row)
        db.commit()
        return {"code": 0, "message": "已收藏", "data": {"added": True}}
    finally:
        db.close()


# ============================================================
# 9. AI 简历优化
# ============================================================


class OptimizeRequest(BaseModel):
    resume_id: int
    mode: str = "professional"  # light / professional / deep


@router.post("/resume/optimize")
def optimize_resume_endpoint(body: OptimizeRequest):
    """AI 优化简历：返回原文与优化后的结构化对比"""
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == body.resume_id).first()
        if not resume:
            return {"code": 1, "message": "简历不存在", "data": None}
        if not resume.content or not resume.content.strip():
            return {"code": 1, "message": "简历内容为空，请重新上传", "data": None}

        # 获取 AI 分析结果（如果已有的话）
        ai_analysis = {}
        # 尝试从已有技能推断分析结果
        skills = db.query(UserSkill).filter(UserSkill.user_id == resume.user_id).all()
        if skills:
            ai_analysis["skills"] = [{"name": s.skill_name, "category": s.category, "level": s.level, "score": s.score} for s in skills]

        # 调用优化
        result = profile_service.optimize_resume(resume.content, ai_analysis, body.mode)

        if result.get("error") and not result.get("fallback"):
            return {"code": 1, "message": result["error"], "data": None}

        return {
            "code": 0,
            "message": "success",
            "data": {
                "resume_id": body.resume_id,
                "mode": body.mode,
                "optimization": result,
                "original_text": resume.content[:3000],
            },
        }
    finally:
        db.close()


# ============================================================
# 10. 访谈分析
# ============================================================


class InterviewAnalyzeRequest(BaseModel):
    conversation: list = []


@router.post("/interview/analyze")
def analyze_interview_endpoint(body: InterviewAnalyzeRequest):
    """分析访谈对话，生成职业分析报告"""
    conversation = body.conversation
    if not conversation:
        return {"code": 1, "message": "访谈内容为空", "data": None}

    result = profile_service.analyze_interview(conversation)
    if result.get("error"):
        return {"code": 1, "message": result["error"], "data": None}

    return {"code": 0, "message": "success", "data": result}


# ============================================================
# 11. 访谈历史记忆：保存 / 加载
# ============================================================


@router.post("/interview/save")
def save_interview_history(body: dict):
    """保存访谈对话历史到数据库"""
    user_id = body.get("user_id", "demo_user")
    messages = body.get("messages", [])

    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id)
            db.add(profile)
        # 存入 interview_data JSONB 字段
        profile.interview_data = {
            "messages": messages,
            "updated_at": datetime.now().isoformat(),
        }
        db.commit()
        return {"code": 0, "message": "访谈记录已保存", "data": {"saved": len(messages)}}
    finally:
        db.close()


@router.get("/interview/history/{user_id}")
def load_interview_history(user_id: str):
    """加载用户之前保存的访谈历史"""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile or not profile.interview_data:
            return {"code": 0, "message": "无历史记录", "data": {"messages": []}}

        history = profile.interview_data if isinstance(profile.interview_data, dict) else {}
        return {
            "code": 0,
            "message": "success",
            "data": {"messages": history.get("messages", [])},
        }
    finally:
        db.close()


# ============================================================
# 10. 删除简历 + 清除访谈记录
# ============================================================


@router.delete("/resume/{resume_id}")
def delete_resume(resume_id: int):
    """删除指定简历（同时删除磁盘文件）"""
    db = SessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return {"code": 1, "message": "简历不存在", "data": None}

        # 删除磁盘文件
        if resume.filepath and os.path.exists(resume.filepath):
            try:
                os.remove(resume.filepath)
            except Exception:
                pass

        db.delete(resume)
        db.commit()
        return {"code": 0, "message": "已删除", "data": None}
    finally:
        db.close()


@router.delete("/interview/clear/{user_id}")
def clear_interview(user_id: str):
    """清除用户的职业访谈记录（软删除：清除已保存的访谈数据）"""
    db = SessionLocal()
    try:
        # 删除来源为 interview 的技能记录
        deleted_skills = (
            db.query(UserSkill)
            .filter(UserSkill.user_id == user_id, UserSkill.source == "interview")
            .delete()
        )
        db.commit()
        return {
            "code": 0,
            "message": f"已清除 {deleted_skills} 条访谈相关记录",
            "data": {"deleted_skills": deleted_skills},
        }
    finally:
        db.close()


# ============================================================
# Helpers
# ============================================================


def _profile_to_dict(p: UserProfile | None) -> dict | None:
    if not p:
        return None
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "school": p.school,
        "major": p.major,
        "education": p.education,
        "grade": p.grade,
        "target_job": p.target_job,
        "bio": p.bio,
        "phone": p.phone,
        "email": p.email,
        "avatar_url": p.avatar_url,
        "completion": p.completion or 0,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _skill_to_dict(s: UserSkill) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "skill_name": s.skill_name,
        "category": s.category,
        "level": s.level,
        "score": s.score,
        "source": s.source,
    }


def _report_to_dict(r: CareerReport) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "tech_score": r.tech_score,
        "project_score": r.project_score,
        "data_score": r.data_score,
        "engineering_score": r.engineering_score,
        "innovation_score": r.innovation_score,
        "learning_score": r.learning_score,
        "overall_score": r.overall_score,
        "advantages": r.advantages,
        "weaknesses": r.weaknesses,
        "suggestions": r.suggestions,
        "match_jobs": r.match_jobs,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# deepseek import for inline analysis in run_career_analysis
from backend.llm import deepseek
