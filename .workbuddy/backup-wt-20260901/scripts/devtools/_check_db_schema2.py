"""临时脚本：检查 the_total_table 的定义、索引、序列，以及 job_postings 是否有 industry_tags 相关列"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "123456",
}


async def main():
    conn = await asyncpg.connect(**DB_CONFIG, timeout=8)

    rows = await conn.fetch("""
        SELECT table_type FROM information_schema.tables WHERE table_name = 'the_total_table'
    """)
    print("the_total_table table_type:", rows[0]["table_type"] if rows else "N/A")

    try:
        v = await conn.fetchrow("""
            SELECT definition FROM pg_views WHERE viewname = 'the_total_table'
        """)
        if v:
            print("== the_total_table VIEW definition ==")
            print(v["definition"][:3000])
    except Exception as e:
        print("view def error:", e)

    try:
        v = await conn.fetchrow("""
            SELECT definition FROM pg_matviews WHERE matviewname = 'the_total_table'
        """)
        if v:
            print("== the_total_table MATVIEW definition ==")
            print(v["definition"][:3000])
    except Exception as e:
        print("matview def error:", e)

    try:
        v = await conn.fetchrow("""
            SELECT pg_get_userbyid(relowner) AS owner, relkind
            FROM pg_class WHERE relname = 'the_total_table'
        """)
        print("relkind:", v)
    except Exception as e:
        print("pg_class error:", e)

    seq = await conn.fetch("""
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'job_postings' AND column_default IS NOT NULL
    """)
    print("== job_postings defaults ==")
    for r in seq:
        print(f"  {r['column_name']}: {r['column_default']}")

    try:
        rows2 = await conn.fetch("""
            SELECT DISTINCT industry_tags FROM the_total_table WHERE industry_tags IS NOT NULL AND industry_tags != '' LIMIT 5
        """)
        print("industry_tags query OK:", len(rows2))
    except Exception as e:
        print("industry_tags query FAIL:", e)

    s = await conn.fetchrow("""
        SELECT id, source_name, job_title, company_name, city, district, salary_min, salary_max,
               salary_unit, experience, education, job_type, publish_time, status, data_source
        FROM the_total_table LIMIT 1
    """)
    print("sample:", dict(s) if s else None)

    c = await conn.fetch("""
        SELECT split_part(city, '·', 1) AS city, count(*)::int AS cnt
        FROM the_total_table
        GROUP BY split_part(city, '·', 1)
        ORDER BY cnt
    """)
    print("== all cities (asc) ==")
    for r in c:
        print(f"  {r['city']}: {r['cnt']}")

    await conn.close()


asyncio.run(main())
