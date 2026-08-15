"""临时脚本：查看 the_total_table 表索引/约束、city 样例值、id 最大值、salary 样例"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "127.0.0.1", "port": 5432,
    "database": "postgres", "user": "postgres", "password": "123456",
}


async def main():
    conn = await asyncpg.connect(**DB_CONFIG, timeout=8)

    print("== constraints ==")
    cons = await conn.fetch("""
        SELECT conname, contype, pg_get_constraintdef(oid) AS def
        FROM pg_constraint WHERE conrelid = 'the_total_table'::regclass
    """)
    for r in cons:
        print(f"  {r['conname']} type={r['contype']}: {r['def']}")

    print("== indexes ==")
    idxs = await conn.fetch("""
        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'the_total_table'
    """)
    for r in idxs:
        print(f"  {r['indexname']}: {r['indexdef']}")

    print("== city samples ==")
    rows = await conn.fetch("""
        SELECT city, count(*)::int AS cnt FROM the_total_table
        GROUP BY city ORDER BY cnt DESC LIMIT 15
    """)
    for r in rows:
        print(f"  '{r['city']}': {r['cnt']}")

    m = await conn.fetchrow("SELECT max(id) AS m, min(id) AS mn FROM the_total_table")
    print("id max/min:", m["m"], m["mn"])

    s = await conn.fetch("""
        SELECT city, job_title, company_name, salary_min, salary_max, salary_unit,
               experience, education, job_type, source_name, data_source
        FROM the_total_table
        WHERE salary_min IS NOT NULL AND salary_max IS NOT NULL
        LIMIT 5
    """)
    print("== salary/field samples ==")
    for r in s:
        print(" ", dict(r))

    await conn.close()


asyncio.run(main())
