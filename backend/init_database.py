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

# 历史代码查询 the_total_table，而爬虫数据存储在两个规范化表中。
# 该视图提供只读兼容层，避免复制或迁移既有岗位数据。
TOTAL_TABLE_VIEW_SQL = """
CREATE OR REPLACE VIEW public.the_total_table AS
SELECT
    jp.id,
    jp.source_name,
    jp.source_id,
    jp.source_id_hash,
    jp.job_title,
    jp.company_name,
    jp.city,
    jp.district,
    jp.salary_min,
    jp.salary_max,
    jp.salary_unit,
    jp.experience,
    jp.education,
    jp.job_type,
    jp.publish_time,
    jp.crawl_time,
    jp.status,
    jp.fingerprint,
    jp.completeness,
    jp.source_name AS data_source,
    COALESCE(jpd.company_industry, '') AS industry_tags,
    COALESCE(array_to_string(jpd.skills, ','), '') AS skills,
    jpd.job_description,
    jp.education AS qualification,
    jp.experience AS work_experience,
    NULL::text AS city_seed,
    NULL::double precision AS sort_weight,
    jpd.company_industry,
    jpd.company_size,
    jpd.company_nature,
    jpd.job_requirement,
    jpd.job_highlights,
    jpd.job_labels,
    jpd.benefits,
    jpd.keywords,
    jpd.job_category_l1,
    jpd.job_category_l2,
    jpd.job_category_l3,
    jpd.work_mode,
    jpd.company_address,
    jpd.source_url,
    jpd.extra,
    jpd.created_at,
    jpd.updated_at
FROM public.job_postings AS jp
LEFT JOIN public.job_posting_details AS jpd ON jpd.job_id = jp.id;
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
            relation_kind = await conn.fetchval(
                """
                SELECT c.relkind
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


if __name__ == "__main__":
    asyncio.run(initialize())
    print("数据库初始化完成：用户中心表和 the_total_table 兼容视图已就绪。")
