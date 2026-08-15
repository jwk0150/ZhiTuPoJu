"""临时脚本：检查数据库连接、the_total_table 视图结构、底层表结构"""
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
    try:
        conn = await asyncpg.connect(**DB_CONFIG, timeout=8)
    except Exception as e:
        print("CONNECT_FAIL:", e)
        return
    print("CONNECT_OK")

    # the_total_table 列
    rows = await conn.fetch("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'the_total_table'
        ORDER BY ordinal_position
    """)
    print("== the_total_table columns ==")
    for r in rows:
        print(f"  {r['column_name']} ({r['data_type']}) null={r['is_nullable']}")

    # the_total_table 是否视图
    vt = await conn.fetchrow("""
        SELECT table_type FROM information_schema.tables WHERE table_name = 'the_total_table'
    """)
    print("table_type:", vt["table_type"] if vt else "NOT FOUND")

    # 底层表
    for tbl in ("job_postings", "job_posting_details"):
        exists = await conn.fetchrow("SELECT 1 FROM information_schema.tables WHERE table_name=$1", tbl)
        if not exists:
            print(f"== {tbl}: NOT FOUND ==")
            continue
        cols = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
        """, tbl)
        print(f"== {tbl} columns ==")
        for r in cols:
            print(f"  {r['column_name']} ({r['data_type']}) null={r['is_nullable']}")

    # 城市岗位数量分布
    cnt = await conn.fetchrow("SELECT count(*)::int AS n FROM the_total_table")
    print("total rows:", cnt["n"])
    cities = await conn.fetch("""
        SELECT split_part(city, '·', 1) AS city, count(*)::int AS cnt
        FROM the_total_table
        GROUP BY split_part(city, '·', 1)
        ORDER BY cnt DESC
        LIMIT 20
    """)
    print("== top cities ==")
    for r in cities:
        print(f"  {r['city']}: {r['cnt']}")

    await conn.close()


asyncio.run(main())
