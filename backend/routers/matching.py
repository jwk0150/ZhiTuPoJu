from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend import data
from backend.matching import service


router = APIRouter()


@router.get("/jobs")
def list_match_jobs():
    jobs = [
        {
            **job,
            "requiredSkills": job.get("required_skills", []),
            "preferredSkills": job.get("preferred_skills", []),
        }
        for job in data.JOBS
    ]
    return data.ok(jobs)


@router.post("/diagnose")
async def diagnose_resume(
    file: Annotated[UploadFile, File(description="PDF、DOC、DOCX或TXT简历")],
    target_job_id: Annotated[str | None, Form()] = None,
<<<<<<< HEAD
):
    try:
        content = await file.read(service.MAX_FILE_BYTES + 1)
        result = service.diagnose(file.filename or "resume", content, target_job_id)
=======
    mode: Annotated[str, Form()] = "b",
):
    try:
        content = await file.read(service.MAX_FILE_BYTES + 1)
        result = service.diagnose(file.filename or "resume", content, target_job_id, mode)
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
        return data.ok(result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()
