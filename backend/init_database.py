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
RAG_SCHEMA = ROOT / "backend" / "sql" / "rag_schema.sql"

# 当前数据源:map_data_table(实际业务表,共 38780 条)。
# 历史代码通过 the_total_table 视图访问岗位数据;这里把视图指向新数据源,
# 保持上层 SQL 完全不变。
TOTAL_TABLE_VIEW_SQL = """
CREATE OR REPLACE VIEW public.the_total_table AS
SELECT * FROM public.map_data_table;
"""

# 本机仅有智联爬虫表时的兼容视图（缺 industry_tags/skills 等列时用 NULL 补齐）
ZHILIAN_COMPAT_VIEW_SQL = """
CREATE OR REPLACE VIEW public.the_total_table AS
SELECT
  id, source_name, source_id, source_id_hash, job_title, company_name,
  city, district, salary_min, salary_max, salary_unit, experience, education,
  job_type, publish_time, crawl_time, status, fingerprint, completeness,
  NULL::text AS industry_tags,
  NULL::text AS skills,
  NULL::text AS job_description,
  NULL::text AS qualification,
  NULL::text AS work_experience,
  NULL::smallint AS city_seed,
  NULL::integer AS sort_weight
FROM public.zhilian_job_postings;
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
            # 检查 map_data_table 是否存在
            # 注意:relkind 是 char 类型,asyncpg 会返回 bytes;用 ::text 保证是 str
            copy1_kind = await conn.fetchval(
                """
                SELECT c.relkind::text
                FROM pg_class AS c
                JOIN pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'map_data_table'
                """
            )
            if copy1_kind is None:
                raise RuntimeError(
                    "public.map_data_table 不存在；请先创建/导入该表（含 38780 条数据）后再运行初始化。"
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
    await ensure_rag_schema()


async def ensure_rag_schema() -> None:
    """幂等应用 RAG 基础设施 Schema（Phase 01）。

    只做 ALTER ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS；
    不清空、不重建、不删除任何现有数据。

    兼容迁移：早期版本把 embedding 建为 cube 类型（本机 cube 上限 100 维，
    无法承载 512 维向量）。若该列存在且为空（本阶段新建、无数据），
    则安全迁移为 double precision[]；非空则拒绝自动修改。
    """
    conn = await asyncpg.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        user=config.PG_USER,
        password=config.PG_PASSWORD,
        database=config.PG_DB,
    )
    try:
        async with conn.transaction():
            # 1) 兼容迁移：cube 列 → double precision[]（仅空列）
            dtype = await conn.fetchval(
                """
                SELECT data_type FROM information_schema.columns
                WHERE table_name='document_chunks' AND column_name='embedding'
                """
            )
            if dtype == "USER-DEFINED":
                filled = await conn.fetchval(
                    "SELECT count(embedding) FROM document_chunks"
                )
                if filled:
                    raise RuntimeError(
                        "document_chunks.embedding 已存在 cube 数据，禁止自动改类型；"
                        "请人工确认后再迁移到 double precision[] / vector。"
                    )
                await conn.execute("DROP INDEX IF EXISTS idx_chunks_embed_gist")
                await conn.execute(
                    "ALTER TABLE document_chunks "
                    "ALTER COLUMN embedding TYPE double precision[] "
                    "USING NULL::double precision[]"
                )
            # 2) 应用幂等 DDL
            sql = RAG_SCHEMA.read_text(encoding="utf-8")
            await conn.execute(sql)
        print("RAG schema 已就绪（source_documents / document_chunks / evidence_items 扩展完成）")
    finally:
        await conn.close()


async def ensure_view_only() -> None:
    """轻量级：保证本地兼容视图可用（不碰云库已有视图）。

    - 若已有 the_total_table（表或视图）或 map_data_table：不做任何替换
    - 否则优先 map_data_table，再回退 zhilian_job_postings
    """
    conn = await asyncpg.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        user=config.PG_USER,
        password=config.PG_PASSWORD,
        database=config.PG_DB,
    )
    try:
        async def _relkind(name: str):
            return await conn.fetchval(
                """
                SELECT c.relkind::text
                FROM pg_class AS c
                JOIN pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = $1
                """,
                name,
            )

        # 云库 zhitu_crawl_db：地图读 map_data_table；已有 the_total_table 视图勿覆盖
        if await _relkind("map_data_table") is not None:
            return
        if await _relkind("the_total_table") is not None:
            return

        copy1_kind = await _relkind("map_data_table")
        if copy1_kind is not None:
            await conn.execute(TOTAL_TABLE_VIEW_SQL)
            return

        zhilian_kind = await _relkind("zhilian_job_postings")
        if zhilian_kind is not None:
            await conn.execute(ZHILIAN_COMPAT_VIEW_SQL)
            return
        # 数据源还未就绪，不强求视图存在
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(initialize())
    print("数据库初始化完成：用户中心表和 the_total_table 兼容视图已就绪。")
