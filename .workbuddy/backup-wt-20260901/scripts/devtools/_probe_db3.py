# -*- coding: utf-8 -*-
import asyncio
import asyncpg


async def try_conn(port, pw, db):
    try:
        c = await asyncpg.connect(
            host="127.0.0.1",
            port=port,
            user="postgres",
            password=pw,
            database=db,
            timeout=3,
        )
        n = await c.fetchval(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
        )
        tables = await c.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
        )
        names = [t["tablename"] for t in tables]
        print(f"OK {port} {db} pw={pw[:4]}*** tables={n}")
        print("  ", names[:30])
        for t in ("the_total_table", "zhilian_job_postings"):
            if t in names:
                cnt = await c.fetchval(f"SELECT count(*) FROM {t}")
                print(f"  {t}: {cnt}")
        await c.close()
    except Exception as e:
        print(f"FAIL {port} {db}: {type(e).__name__}: {str(e)[:160]}")


async def main():
    cases = [
        (5432, "Shangshanruoshui@", "zhitu_crawl_db"),
        (3309, "Shangshanruoshui@", "zhitu_crawl_db"),
        (3309, "Shangshanruoshui@", "zhilian_crawl_db"),
        (3309, "123456", "zhitu_crawl_db"),
        (3309, "123456", "zhilian_crawl_db"),
    ]
    for port, pw, db in cases:
        await try_conn(port, pw, db)


if __name__ == "__main__":
    asyncio.run(main())
