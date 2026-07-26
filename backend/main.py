from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import collection, discovery, evolution, graph


app = FastAPI(title="Job Ability Graph API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"code": 0, "message": "success", "data": {"status": "ok"}}


app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])

app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])

