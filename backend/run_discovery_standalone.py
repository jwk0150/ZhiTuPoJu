# 仅用于本地验证 Discovery 爬虫服务（不依赖数据库/其他路由）
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import discovery

app = FastAPI(title="Discovery Standalone")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])


@app.get("/api/health")
def h():
    return {"ok": True}
