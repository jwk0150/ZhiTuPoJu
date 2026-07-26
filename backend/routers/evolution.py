from fastapi import APIRouter, Query

from backend import data


router = APIRouter()


@router.get("/profiles")
def get_evolution_profiles():
    return data.ok(data.EVOLUTION_PROFILES)


@router.get("/jobs/{job_id}")
def get_job_evolution(job_id: str):
    for profile in data.EVOLUTION_PROFILES:
        if profile["job_id"] == job_id:
            return data.ok(profile)
    return {"code": 1, "message": "evolution profile not found", "data": None}


@router.get("/skills")
def get_skill_evolution(keyword: str = Query(default="")):
    keyword = keyword.strip().lower()
    rows = []

    for profile in data.EVOLUTION_PROFILES:
        for skill in profile.get("added_skills", []):
            if keyword and keyword not in skill["name"].lower():
                continue
            rows.append(
                {
                    "job_id": profile["job_id"],
                    "job_title": profile["job_title"],
                    "skill": skill["name"],
                    "change_type": "added",
                    "change_value": skill["growth"],
                    "evidence_count": skill["evidence_count"],
                }
            )
        for skill in profile.get("weakened_skills", []):
            if keyword and keyword not in skill["name"].lower():
                continue
            rows.append(
                {
                    "job_id": profile["job_id"],
                    "job_title": profile["job_title"],
                    "skill": skill["name"],
                    "change_type": "weakened",
                    "change_value": skill["decline"],
                    "reason": skill["reason"],
                }
            )

    return data.ok(rows)
