from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend import data
from backend.knowledge.ingestion import fetch_jobs
from backend.llm import job_matching_agent
from backend.matching import service


router = APIRouter()


class AgentMatchRequest(BaseModel):
    """JobMatchingAgent 自然语言入口（Phase 08-B）。"""
    message: str = ""
    resume_text: str | None = None
    filename: str = "resume.txt"
    context: dict[str, Any] = {}
    selected_job_id: str | None = None
    history: list[dict[str, Any]] = []


@router.get("/jobs")
def list_match_jobs(limit: int = Query(50, ge=1, le=200)):
    """真实岗位列表（供前端岗位选择/展示；字段对齐原 data.JOBS 契约）。"""
    rows = fetch_jobs(limit=limit)
    jobs = []
    for row in rows:
        job = service.to_match_job_dict(row)
        job["requiredSkills"] = job["required_skills"]
        job["preferredSkills"] = job["preferred_skills"]
        jobs.append(job)
    return data.ok(jobs)


@router.post("/diagnose")
async def diagnose_resume(
    file: Annotated[UploadFile, File(description="PDF、DOC、DOCX或TXT简历")],
    target_job_id: Annotated[str | None, Form()] = None,
    mode: Annotated[str, Form()] = "b",
):
    """真实人岗匹配：简历 → Profile → KnowledgeService 召回 → MatchingService → 解释。

    若 DeepSeek 失败或候选为空，仍返回结构化匹配结果（不报错、不编造）。
    """
    try:
        content = await file.read(service.MAX_FILE_BYTES + 1)
        filename = file.filename or "resume"

        # 1) 简历解析（复用现有）
        document = service.extract_document(filename, content)
        profile, parse_meta = service.parse_resume(document["text"], filename)

        # 2) 候选岗位召回（Hybrid → SQL → Demo）
        jobs = service.retrieve_candidate_jobs(profile, top_k=20, target_job_id=target_job_id)

        # 3) 评分 + Evidence + DeepSeek 解释
        result = service.diagnose_from_profile(
            profile, jobs, target_job_id=target_job_id, mode=mode,
            parse_meta=parse_meta, document=document,
        )
        return data.ok(result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()


@router.post("/agent")
def match_agent(payload: AgentMatchRequest):
    """JobMatchingAgent 自然语言入口。

    确定性匹配请继续使用 POST /api/match/diagnose；本端点面向：
    EXPLAIN（为什么推荐）/ GAP（缺什么）/ WHAT_IF（加技能会怎样）/
    JOB_ANALYSIS（岗位分析）/ LEARNING（如何提升）/ MATCH（推荐岗位）。
    """
    result = job_matching_agent.run(
        message=payload.message or "",
        resume_text=payload.resume_text,
        filename=payload.filename or "resume.txt",
        context=payload.context or {},
        selected_job_id=payload.selected_job_id,
        history=payload.history or [],
    )
    return data.ok(result)
