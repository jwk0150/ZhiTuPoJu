from fastapi import APIRouter, Query

from backend import data


router = APIRouter()


@router.get("")
@router.get("/")
def get_graph():
    return data.ok(data.get_graph_payload())


@router.get("/job/{job_id}")
def get_graph_by_job(job_id: str):
    return data.ok(data.get_job_subgraph(job_id))


@router.get("/search")
def search_graph(keyword: str = Query(default="")):
    keyword = keyword.strip().lower()
    if not keyword:
        return data.ok([])

    results = []
    for node in data.GRAPH_NODES:
        label = node.get("label", "")
        if keyword in label.lower():
            results.append(
                {
                    "id": node["id"],
                    "label": label,
                    "type": node["type"],
                    "matched_field": "label",
                }
            )
    return data.ok(results)
