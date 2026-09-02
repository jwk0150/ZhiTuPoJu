from __future__ import annotations

import re
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend import data
from backend.knowledge.ingestion import fetch_jobs
from backend.llm import deepseek, job_matching_agent
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


class InterviewEvaluateRequest(BaseModel):
    """面试回答评估请求。

    score/metrics 由后端规则计算，LLM 只负责生成文字反馈，避免把评分交给模型。
    """
    question: str = ""
    answer: str = ""
    keywords: list[str] = []
    job_title: str = ""
    resume_context: str = ""


def _evaluate_interview_answer(answer: str, keywords: list[str]) -> dict[str, Any]:
    text = (answer or "").strip()
    compact = re.sub(r"\s+", "", text)
    words = len(compact)
    matched = [k for k in (keywords or []) if k and str(k).lower() in text.lower()]
    # 30% 完整度 + 30% 关键词覆盖 + 25% 项目事实 + 15% STAR 结构
    completeness = min(100, round(words / 180 * 100)) if words else 0
    keyword_coverage = round(len(matched) / max(1, len(keywords)) * 100)
    fact_markers = ("项目", "负责", "实现", "优化", "提升", "%", "万", "ms", "用户", "结果")
    fact_score = min(100, sum(1 for marker in fact_markers if marker.lower() in text.lower()) * 14)
    structure_score = min(100, sum(1 for marker in ("背景", "目标", "行动", "结果", "STAR") if marker.lower() in text.lower()) * 20)
    score = round(completeness * 0.30 + keyword_coverage * 0.30 + fact_score * 0.25 + structure_score * 0.15)
    strengths = []
    gaps = []
    if completeness >= 55:
        strengths.append("回答信息较完整")
    else:
        gaps.append("回答偏短，建议补充背景、过程与结果")
    if keyword_coverage >= 50:
        strengths.append("覆盖了岗位相关关键词")
    elif keywords:
        gaps.append("尚未覆盖足够的岗位关键词")
    if fact_score >= 42:
        strengths.append("包含项目职责或结果证据")
    else:
        gaps.append("缺少可验证的项目事实或量化结果")
    if structure_score >= 40:
        strengths.append("具备一定结构化表达")
    else:
        gaps.append("可使用 STAR 结构组织表达")
    return {
        "score": max(0, min(100, score)),
        "metrics": {"completeness": completeness, "technical": keyword_coverage, "evidence": fact_score, "structure": structure_score},
        "matched_keywords": matched,
        "strengths": strengths,
        "gaps": gaps,
    }


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


@router.post("/interview/evaluate")
def evaluate_interview_answer(payload: InterviewEvaluateRequest):
    """评估单条面试回答。

    规则分数始终可用；配置 DeepSeek 时额外生成文字点评，但不改变分数。
    """
    evaluation = _evaluate_interview_answer(payload.answer, payload.keywords)
    system = (
        "你是面试教练。只根据题目和回答给出简短、可执行的中文点评，"
        "不要输出分数，不要补充回答中不存在的经历。严格输出 JSON："
        '{"feedback":"","next_action":""}'
    )
    user = (
        f"岗位：{payload.job_title}\n题目：{payload.question}\n"
        f"回答：{payload.answer}\n已匹配关键词：{', '.join(evaluation['matched_keywords']) or '无'}"
    )
    feedback = ""
    next_action = ""
    meta: dict[str, Any] = {"source": "rule", "llm": None, "error": None}
    if payload.answer.strip() and deepseek.is_configured():
        content, call_meta = deepseek.chat_completions(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.2,
            timeout=30.0,
        )
        if content and not call_meta.get("error"):
            try:
                parsed = service._json_from_text(content) if hasattr(service, "_json_from_text") else {}
                feedback = str(parsed.get("feedback") or "").strip()
                next_action = str(parsed.get("next_action") or "").strip()
                if feedback or next_action:
                    meta.update({"source": "deepseek", "llm": call_meta.get("llm")})
            except Exception as exc:
                meta["error"] = str(exc)
        elif call_meta.get("error"):
            meta["error"] = call_meta["error"]
    if not feedback:
        feedback = "；".join(evaluation["strengths"]) if evaluation["strengths"] else "先完整回答题目，再补充技术细节。"
    if not next_action:
        next_action = evaluation["gaps"][0] if evaluation["gaps"] else "继续补充量化结果和可验证证据。"
    evaluation.update({"feedback": feedback, "next_action": next_action, "source": meta["source"], "llm": meta["llm"], "error": meta["error"]})
    return data.ok(evaluation)


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
