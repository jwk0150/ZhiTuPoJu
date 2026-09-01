"""数据库连接池 (asyncpg) —— 用于数字人才地图查询"""
import asyncpg

from backend.config import config

# 数据库连接池
_pool: asyncpg.Pool | None = None

DB_CONFIG = {
    "host": config.PG_HOST,
    "port": config.PG_PORT,
    "database": config.PG_DB,
    "user": config.PG_USER,
    "password": config.PG_PASSWORD,
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
