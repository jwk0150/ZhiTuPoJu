from fastapi import APIRouter

from backend import data


router = APIRouter()


@router.get("/sources")
def get_sources():
    return data.ok(data.SOURCES)


@router.get("/summary")
def get_collection_summary():
    total = sum(source["today_count"] for source in data.SOURCES)
    duplicate_count = 84
    cleaned_count = max(total - 96, 0)
    valid_count = max(cleaned_count - duplicate_count, 0)
    return data.ok(
        {
            "total_collected": total,
            "cleaned_count": cleaned_count,
            "duplicate_count": duplicate_count,
            "valid_count": valid_count,
            "avg_quality_score": 91.6,
            "source_count": len(data.SOURCES),
            "freshness": {"fresh": 842, "aging": 143, "stale": 27},
            "format_distribution": [
                {"format": "HTML", "count": 760},
                {"format": "JSON", "count": 210},
                {"format": "PDF", "count": 180},
                {"format": "DOCX", "count": 80},
                {"format": "CSV/XLSX", "count": 50},
            ],
        }
    )


@router.get("/cleaning-samples")
def get_cleaning_samples():
    return data.ok(data.CLEANING_SAMPLES)
