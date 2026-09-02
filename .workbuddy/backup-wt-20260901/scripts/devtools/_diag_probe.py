import sys
sys.stdout = open("_diag_probe.txt", "w", encoding="utf-8")

try:
    import asyncpg
    print("asyncpg OK")
except Exception as e:
    print("asyncpg FAIL:", repr(e))
    sys.exit(1)

import asyncio

DSN = "postgresql://postgres:20051122@127.0.0.1:5433/zhitu_crawl_db"


async def main():
    try:
        conn = await asyncio.wait_for(asyncpg.connect(DSN), timeout=5)
        print("connect OK")
        v = await conn.fetchval("SELECT version()")
        print("PG version:", v)
        n = await conn.fetchval("SELECT COUNT(*) FROM the_total_table")
        print("total rows:", n)
        await conn.close()
    except Exception as e:
        print("FAIL:", repr(e))


asyncio.run(main())
