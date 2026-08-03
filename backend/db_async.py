"""数据库连接池 (asyncpg) —— 用于数字人才地图查询"""
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# 数据库连接池
_pool: asyncpg.Pool | None = None

DB_CONFIG = {
    "host": os.getenv("PG_HOST") or os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("PG_PORT") or os.getenv("DB_PORT", "5433")),
    "database": os.getenv("PG_DB") or os.getenv("DB_NAME", "zhitu_crawl_db"),
    "user": os.getenv("PG_USER") or os.getenv("DB_USER", "postgres"),
    "password": os.getenv("PG_PASSWORD") or os.getenv("DB_PASSWORD", "20051122"),
}


async def get_pool() -> asyncpg.Pool:
    """获取连接池（懒加载）"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            **DB_CONFIG,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
