# -*- coding: utf-8 -*-
"""统一配置管理 — 解决不同开发者环境差异"""
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

# 加载 .env 文件（override=True 确保覆盖系统环境变量）
_ENV_PATH = Path(__file__).parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=True)


class Config:
    """应用配置类 — 所有配置项从环境变量读取，并提供合理的默认值"""

    # ============ DeepSeek AI ============
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # ============ RAG Embedding / VectorStore ============
    # 模型名：HuggingFace 模型 id（BGE-small-zh-v1.5，中文检索、512 维、CPU 可跑）
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
    # 模型输出维度（必须与模型一致；bge-small-zh-v1.5 = 512，兼容 cube 扩展 2048 上限）
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "512"))
    # embedding 版本号：模型/维度/归一化策略变化时递增，用于向量失效与重建
    EMBEDDING_VERSION: str = os.getenv("EMBEDDING_VERSION", "bge-small-zh-v1.5@v1")
    # 推理设备：cpu / cuda
    EMBEDDING_DEVICE: str = os.getenv("EMBEDDING_DEVICE", "cpu")
    # 向量存储实现：array（当前默认，double precision[] + numpy，免安装）|
    #               cube（本机 100 维上限，不适用 512 维）| pgvector（未来安装后切换）
    VECTOR_STORE: str = os.getenv("VECTOR_STORE", "array")

    # ============ Hybrid Retrieval ============
    # 融合权重（可配置；metadata 腿当前为 0，见 service.hybrid_search 说明）
    HYBRID_WEIGHT_VECTOR: float = float(os.getenv("HYBRID_WEIGHT_VECTOR", "0.5"))
    HYBRID_WEIGHT_KEYWORD: float = float(os.getenv("HYBRID_WEIGHT_KEYWORD", "0.3"))
    HYBRID_WEIGHT_METADATA: float = float(os.getenv("HYBRID_WEIGHT_METADATA", "0.0"))
    # 最低相关度阈值：低于此分数的查询返回 INSUFFICIENT_EVIDENCE
    # （考虑向量腿贡献上限 0.5、关键词腿 0.3，0.22 兼顾召回与低噪）
    HYBRID_MIN_SCORE: float = float(os.getenv("HYBRID_MIN_SCORE", "0.22"))
    # RAG 证据相关度下限（Global Agent knowledge.ask 二次过滤）
    # 实测：keyword-only 模式下命中标题的 final_score = w_k * kw = 0.3，
    #       向量腿可用时最高可达 0.8；默认 0.25 在两种模式下均保留有效命中。
    RAG_MIN_RELEVANCE: float = float(os.getenv("RAG_MIN_RELEVANCE", "0.25"))

    # ============ PostgreSQL ============
    PG_HOST: str = os.getenv("PG_HOST", "127.0.0.1")
    PG_PORT: int = int(os.getenv("PG_PORT", "5432"))  # 标准PostgreSQL端口
    PG_USER: str = os.getenv("PG_USER", "postgres")
    PG_PASSWORD: str = os.getenv("PG_PASSWORD", "")
    PG_DB: str = os.getenv("PG_DB", "zhitu_crawl_db")
    # 数字人才地图主数据表（云库 zhitu_crawl_db.map_data_table）
    PG_JOB_TABLE: str = os.getenv("PG_JOB_TABLE", "map_data_table")

    # ============ 后端服务 ============
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    # 前端静态页面默认连接 5000，后端默认值必须与其一致。
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "5000"))

    # ============ 表名前缀配置 ============
    # 不同环境可能使用不同的表名前缀（如：zhilian_、boss_、lagou_）
    TABLE_PREFIX: str = os.getenv("TABLE_PREFIX", "zhilian_")

    # ============ JWT 认证 ============
    # 生产环境务必通过环境变量覆盖（生成方式：python -c "import secrets; print(secrets.token_urlsafe(48))"）
    JWT_SECRET: str = os.getenv("JWT_SECRET", "zhitu-dev-secret-change-me")
    # Token 有效期（秒），默认 7 天
    JWT_TTL: int = int(os.getenv("JWT_TTL", str(7 * 24 * 3600)))

    # ============ 数字人才地图主表 ============
    # 岗位主表（含 skills 技能列），供岗位聚合 / 我的能力技术目录使用
    PG_JOB_TABLE: str = os.getenv("PG_JOB_TABLE", "map_data_table")

    @classmethod
    def get_db_url(cls) -> str:
        """生成数据库连接URL"""
        return (
            f"postgresql://{cls.PG_USER}:{quote_plus(cls.PG_PASSWORD)}@"
            f"{cls.PG_HOST}:{cls.PG_PORT}/{cls.PG_DB}"
        )

    @classmethod
    def get_table_name(cls, base_name: str) -> str:
        """根据配置的前缀生成完整表名"""
        return f"{cls.TABLE_PREFIX}{base_name}"


# 全局配置实例
config = Config()
