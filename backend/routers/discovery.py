from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend import data


router = APIRouter()


class StatusUpdate(BaseModel):
    status: str


@router.get("/jobs")
def get_discovery_jobs(
    status: str = Query(default="all"),
    keyword: str = Query(default=""),
    sort: str = Query(default="confidence"),
):
    jobs = list(data.NEW_JOBS)

    if status != "all":
        jobs = [job for job in jobs if job["status"] == status]

    keyword = keyword.strip().lower()
    if keyword:
        jobs = [
            job
            for job in jobs
            if keyword in job["title"].lower()
            or any(keyword in skill.lower() for skill in job.get("core_skills", []))
        ]

    if sort == "growth":
        jobs.sort(key=lambda job: job["growth_rate"], reverse=True)
    elif sort == "date":
        jobs.sort(key=lambda job: job["discovered_at"], reverse=True)
    else:
        jobs.sort(key=lambda job: job["confidence"], reverse=True)

    return data.ok(jobs)


@router.get("/jobs/{job_id}")
def get_discovery_job_detail(job_id: str):
    for job in data.NEW_JOBS:
        if job["id"] == job_id:
            return data.ok(job)
    return {"code": 1, "message": "job not found", "data": None}


@router.post("/jobs/{job_id}/status")
def update_discovery_job_status(job_id: str, payload: StatusUpdate):
    if payload.status not in {"pending", "adopted", "rejected"}:
        return {"code": 1, "message": "invalid status", "data": None}

    for job in data.NEW_JOBS:
        if job["id"] == job_id:
            job["status"] = payload.status
            return data.ok({"id": job_id, "status": payload.status})
    return {"code": 1, "message": "job not found", "data": None}
