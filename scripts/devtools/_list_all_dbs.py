# -*- coding: utf-8 -*-
import asyncio
import asyncpg


async def main():
    c = await asyncpg.connect(
        host="127.0.0.1",
        port=3309,
        user="postgres",
        password="123456",
        database="postgres",
        timeout=5,
    )
    dbs = await c.fetch("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1")
    print("databases:", [r["datname"] for r in dbs])
    await c.close()

    for db in [r["datname"] for r in dbs]:
        try:
            conn = await asyncpg.connect(
                host="127.0.0.1",
                port=3309,
                user="postgres",
                password="123456",
                database=db,
                timeout=5,
            )
            tables = await conn.fetch(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
            )
            names = [t["tablename"] for t in tables]
            views = await conn.fetch(
                "SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY 1"
            )
            vnames = [v["viewname"] for v in views]
            print(f"\n== {db} ==")
            print("tables:", names)
            print("views:", vnames)
            for t in ("the_total_table", "map_data_table", "zhilian_job_postings"):
                if t in names or t in vnames:
                    try:
                        n = await conn.fetchval(f'SELECT count(*) FROM "{t}"')
                        print(f"  {t}: {n}")
                    except Exception as e:
                        print(f"  {t}: err {e}")
            await conn.close()
        except Exception as e:
            print(f"{db}: {e}")


if __name__ == "__main__":
    asyncio.run(main())
