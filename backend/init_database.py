"""安全初始化后端所需的数据库兼容对象。

只创建缺失的 schema、表和视图，不清空或修改已有岗位数据。
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import config


USER_CENTER_SCHEMA = ROOT / "backend" / "sql" / "user_center_schema.sql"

# 当前数据源:the_total_table_copy1(实际业务表,共 38780 条)。
# 历史代码通过 the_total_table 视图访问岗位数据;这里把视图指向新数据源,
# 保持上层 SQL 完全不变。
TOTAL_TABLE_VIEW_SQL = """
CREATE OR REPLACE VIEW public.the_total_table AS
SELECT * FROM public.the_total_table_copy1;
"""


async def initialize() -> None:
    conn = await asyncpg.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        user=config.PG_USER,
        password=config.PG_PASSWORD,
        database=config.PG_DB,
    )
    try:
        schema_sql = USER_CENTER_SCHEMA.read_text(encoding="utf-8")
        schema_sql = schema_sql.replace("BEGIN;", "").replace("COMMIT;", "")
        async with conn.transaction():
            await conn.execute(schema_sql)
            # 检查 the_total_table_copy1 是否存在
            # 注意:relkind 是 char 类型,asyncpg 会返回 bytes;用 ::text 保证是 str
            copy1_kind = await conn.fetchval(
                """
                SELECT c.relkind::text
                FROM pg_class AS c
                JOIN pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'the_total_table_copy1'
                """
            )
            if copy1_kind is None:
                raise RuntimeError(
                    "public.the_total_table_copy1 不存在；请先创建/导入该表（含 38780 条数据）后再运行初始化。"
                )
            relation_kind = await conn.fetchval(
                """
                SELECT c.relkind::text
                FROM pg_class AS c
                JOIN pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'the_total_table'
                """
            )
            if relation_kind not in (None, "v"):
                raise RuntimeError(
                    "public.the_total_table 已存在但不是视图；为避免覆盖数据，未执行初始化。"
                )
            await conn.execute(TOTAL_TABLE_VIEW_SQL)
    finally:
        await conn.close()


async def ensure_view_only() -> None:
    """轻量级：仅保证 the_total_table 视图指向 the_total_table_copy1。

    用于后端启动时自动应用，配合 init_database() 的安全检查使用，
    避免业务数据被覆盖。本函数不修改任何业务表，不创建 user_center schema。
    """
    conn = await asyncpg.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        user=config.PG_USER,
        password=config.PG_PASSWORD,
        database=config.PG_DB,
    )
    try:
        # 确保源表存在
        # 注意:relkind 是 char 类型,asyncpg 会返回 bytes;用 ::text 保证是 str
        copy1_kind = await conn.fetchval(
            """
            SELECT c.relkind::text
            FROM pg_class AS c
            JOIN pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'the_total_table_copy1'
            """
        )
        if copy1_kind is None:
            # 数据源还未就绪，不强求视图存在，由调用方决定如何降级
            return
        relation_kind = await conn.fetchval(
            """
            SELECT c.relkind::text
            FROM pg_class AS c
            JOIN pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'the_total_table'
            """
        )
        if relation_kind == "r":
            # the_total_table 是真实表，不动它（避免覆盖业务数据）
            return
        # None 或者 'v' 都允许 CREATE OR REPLACE VIEW
        await conn.execute(TOTAL_TABLE_VIEW_SQL)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(initialize())
    print("数据库初始化完成：用户中心表和 the_total_table 兼容视图已就绪。")
