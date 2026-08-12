# -*- coding: utf-8 -*-
"""临时验证：抽查种子数据质量 + 验证 fetch_city_jobs_full 的 SQL 可执行"""
import io
import sys
import asyncio

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import asyncpg


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432,
                                 user="postgres", password="123456",
                                 database="postgres")

    # 抽查南昌 ai_seed 数据
    rows = await conn.fetch(
        "SELECT job_title, company_name, city, salary_min, salary_max, salary_unit, "
        "experience, education, industry_tags, skills, job_description, "
        "qualification, work_experience, source_name, source_id "
        "FROM the_total_table WHERE source_name='ai_seed' AND city='南昌' ORDER BY job_title LIMIT 5"
    )
    print("== 南昌 ai_seed 抽查 ==")
    for r in rows:
        print(dict(r))

    # 验证 fetch_city_jobs_full 的核心 SQL 可执行
    print("\n== fetch_city_jobs_full 核心 SQL 验证（南昌） ==")
    rows2 = await conn.fetch(
        """
        SELECT split_part(city,'·',1) AS city, job_title,
               count(*)::int AS cnt,
               min(salary_min)::float AS avg_salary_min,
               max(salary_max)::float AS avg_salary_max,
               string_agg(DISTINCT industry_tags, ',') AS industries
        FROM the_total_table
        WHERE (split_part(city, '·', 1) = $1 OR split_part(city, '·', 1) = $1 || '市')
          AND job_title IS NOT NULL AND job_title <> ''
        GROUP BY split_part(city,'·',1), job_title
        ORDER BY cnt DESC, job_title
        LIMIT 25
        """,
        "南昌",
    )
    print(f"行数: {len(rows2)}")
    for r in rows2[:10]:
        print(f"  {r['job_title']} cnt={r['cnt']} 薪资={r['avg_salary_min']:.0f}-{r['avg_salary_max']:.0f} tags={r['industries']}")

    # 验证 fetch_provinces_summary 中 industry_tags 查询可执行
    print("\n== fetch_provinces_summary industry_tags 查询验证 ==")
    r3 = await conn.fetchval(
        "SELECT count(DISTINCT industry_tags) FROM the_total_table WHERE industry_tags IS NOT NULL AND industry_tags <> ''"
    )
    print("distinct industry_tags:", r3)

    # 验证 fetch_filter_options
    print("\n== fetch_filter_options 行业查询验证 ==")
    r4 = await conn.fetch(
        "SELECT DISTINCT industry_tags FROM the_total_table WHERE industry_tags IS NOT NULL AND industry_tags <> '' LIMIT 10"
    )
    for x in r4:
        print(" ", x["industry_tags"])

    await conn.close()


asyncio.run(main())
