# -*- coding: utf-8 -*-
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.services import _city_match_sql, _norm_city_for_query


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432, user="postgres",
                                 password="123456", database="postgres")
    short = "南昌"
    n1 = await conn.fetchval("SELECT count(*) FROM the_total_table WHERE split_part(city,'·',1)=$1", short)
    n2 = await conn.fetchval(
        f"SELECT count(*) FROM the_total_table WHERE {_city_match_sql('1')}", short)
    print(f"split_part匹配={n1}   city_match匹配={n2}")
    # city 字段实际值分布
    rows = await conn.fetch(
        "SELECT city, count(*)::int AS c FROM the_total_table WHERE split_part(city,'·',1)=$1 GROUP BY city ORDER BY c DESC LIMIT 10",
        short)
    for r in rows:
        print(f"  city='{r['city']}' → {r['c']}")
    await conn.close()


asyncio.run(main())
