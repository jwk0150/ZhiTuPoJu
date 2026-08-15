"""临时脚本：查看 the_total_table 关键列类型 + CITY_TO_PROVINCE 全部城市键"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "127.0.0.1", "port": 5432,
    "database": "postgres", "user": "postgres", "password": "123456",
}


async def main():
    conn = await asyncpg.connect(**DB_CONFIG, timeout=8)
    rows = await conn.fetch("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'the_total_table'
        ORDER BY ordinal_position
    """)
    print("== all columns & types ==")
    for r in rows:
        print(f"  {r['column_name']} | {r['data_type']} | null={r['is_nullable']}")

    s = await conn.fetchrow("""
        SELECT * FROM the_total_table
        WHERE city LIKE '南昌%' OR city LIKE '九江%'
        LIMIT 3
    """)
    if s:
        print("== sample rows (南昌/九江) ==")
        for k, v in dict(s).items():
            print(f"  {k} = {v!r}")
    else:
        print("no 南昌/九江 rows")

    from backend.mappings import CITY_TO_PROVINCE
    print("== CITY_TO_PROVINCE keys (count=%d) ==" % len(CITY_TO_PROVINCE))
    for c in CITY_TO_PROVINCE:
        print(f"  {c}")

    await conn.close()


asyncio.run(main())
