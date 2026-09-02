# -*- coding: utf-8 -*-
"""临时检查：确认 the_total_table 列类型 + 南昌样例 + status 分布 + 各城市岗位标题数"""
import asyncio
import asyncpg


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432,
                                 user="postgres", password="123456",
                                 database="postgres")
    cols = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='the_total_table' ORDER BY ordinal_position"
    )
    print("== COLUMNS ==")
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']}")

    rows = await conn.fetch(
        "SELECT id, source_name, job_title, company_name, city, salary_min, salary_max, "
        "salary_unit, experience, education, job_type, status, completeness, fingerprint "
        "FROM the_total_table WHERE city = '南昌' OR city LIKE '南昌%' LIMIT 3"
    )
    print("\n== 南昌样例 ==")
    for r in rows:
        print(" ", dict(r))

    st = await conn.fetch("SELECT status, count(*) AS c FROM the_total_table GROUP BY status")
    print("\n== status 分布 ==")
    for x in st:
        print(" ", dict(x))

    # 每个城市 distinct job_title 数（top 15）
    dist = await conn.fetch(
        "SELECT split_part(city,'·',1) AS c, count(*) AS rows_cnt, "
        "count(DISTINCT job_title) AS title_cnt "
        "FROM the_total_table WHERE job_title IS NOT NULL AND job_title <> '' "
        "GROUP BY c ORDER BY title_cnt DESC LIMIT 15"
    )
    print("\n== 城市 distinct 岗位标题 TOP15 ==")
    for x in dist:
        print(f"  {x['c']}: rows={x['rows_cnt']} titles={x['title_cnt']}")

    await conn.close()


asyncio.run(main())
