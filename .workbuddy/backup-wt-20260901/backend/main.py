from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 注：项目实际仅存在以下 router 源文件（agent/collection/discovery/evolution/graph/matching/data/profile/trends 缺失，未纳入版本控制）
from backend.routers import talent_map, auth, ability, discovery
from backend.db_async import close_pool
from backend.config import config
from backend.init_database import ensure_view_only


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时确保 the_total_table 视图指向 the_total_table_copy1（幂等）
    try:
        await ensure_view_only()
    except Exception:
        # 数据源未就绪时不阻断后端启动；后续请求会按情况报错
        pass
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


@app.get("/api/config-status")
def config_status():
    """返回当前配置状态（不暴露敏感信息）"""
    return {
        "code": 0,
        "message": "success",
        "data": {
            "backend_host": config.BACKEND_HOST,
            "backend_port": config.BACKEND_PORT,
            "pg_host": config.PG_HOST,
            "pg_port": config.PG_PORT,
            "pg_db": config.PG_DB,
            "deepseek_configured": bool(config.DEEPSEEK_API_KEY),
            "table_prefix": config.TABLE_PREFIX,
        }
    }


# 原有路由（仅保留项目中实际存在的 router 源文件）
# 缺失模块：collection / graph / agent / evolution / matching / data / profile / trends
# 待补充对应源文件后取消注释即可恢复：
#   app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
#   app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
#   app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
#   app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])
#   app.include_router(matching.router, prefix="/api/match", tags=["matching"])
#   app.include_router(data.router, prefix="/api/data", tags=["data"])
#   app.include_router(profile.router, prefix="/api/profile", tags=["user-profile"])
#   app.include_router(trends.router, prefix="/api/trends", tags=["trends"])

# 智能发现爬虫服务（真实多源数据采集，独立运行，不依赖数据库）
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])

# 数字人才地图路由（注册两个前缀，分别服务地图和岗位图谱功能）
app.include_router(talent_map.router, prefix="/api/map", tags=["talent-map"])
app.include_router(talent_map.router, prefix="/api/graph", tags=["talent-graph"])

# 用户认证路由（登录注册）
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# 我的能力路由（技术目录 + 用户能力问卷/图谱）
app.include_router(ability.router, prefix="/api/ability", tags=["ability"])
