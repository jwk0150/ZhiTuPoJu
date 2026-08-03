from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import agent, collection, discovery, evolution, graph, matching, data, talent_map
from backend.db_async import close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="Job Ability Graph API", version="0.2.0", lifespan=lifespan)

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


# 原有路由
app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])
app.include_router(matching.router, prefix="/api/match", tags=["matching"])

# 新增：数据库查询路由（从 ZhiTuPoJu1）
app.include_router(data.router, prefix="/api/data", tags=["data"])

# 新增：数字人才地图路由（从 ZhiTuPoJu）
# 注册两个前缀，分别服务地图和岗位图谱功能
app.include_router(talent_map.router, prefix="/api/map", tags=["talent-map"])
app.include_router(talent_map.router, prefix="/api/graph", tags=["talent-graph"])
