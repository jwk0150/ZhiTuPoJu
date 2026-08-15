import asyncio
import sys

_OUT = open("_diag_schema_out.txt", "w", encoding="utf-8")
sys.stdout = _OUT

import asyncpg

DSN = "postgresql://postgres:123456@127.0.0.1:5432/postgres"


async def main():
    conn = await asyncpg.connect(DSN)
    cols = await conn.fetch(
        """SELECT column_name, data_type FROM information_schema.columns
           WHERE table_name='the_total_table' ORDER BY ordinal_position"""
    )
    for c in cols:
        print(f"{c['column_name']}: {c['data_type']}")
    print("---- sample source_name values ----")
    rows = await conn.fetch(
        "SELECT source_name, count(*)::int AS n FROM the_total_table GROUP BY source_name ORDER BY n DESC LIMIT 20"
    )
    for r in rows:
        print(f"{r['source_name']!r}: {r['n']}")
    print("---- sample city values (raw) ----")
    rows = await conn.fetch(
        "SELECT city, count(*)::int AS n FROM the_total_table WHERE city IS NOT NULL AND city<>'' GROUP BY city ORDER BY n DESC LIMIT 10"
    )
    for r in rows:
        print(f"{r['city']!r}: {r['n']}")
    await conn.close()
    _OUT.close()


asyncio.run(main())
