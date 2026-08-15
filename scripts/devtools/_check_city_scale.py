# -*- coding: utf-8 -*-
"""统计当前数据库各城市岗位规模，用于确定扩充系数"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.mappings import CITY_TO_PROVINCE


async def main():
    conn = await asyncpg.connect(
        host="127.0.0.1", port=5432, user="postgres",
        password="123456", database="postgres",
    )
    try:
        # 城市 → 记录数、类型数、ai_seed占比
        rows = await conn.fetch("""
            SELECT split_part(city, '·', 1) AS city,
                   count(*)::int AS records,
                   count(DISTINCT job_title)::int AS types,
                   count(*) FILTER (WHERE source_name = 'ai_seed')::int AS seed_records
            FROM the_total_table
            WHERE city IS NOT NULL AND city <> ''
            GROUP BY split_part(city, '·', 1)
            ORDER BY records DESC
        """)
        print(f"{'城市':<8}{'记录数':>6}{'类型数':>6}{'ai_seed':>8}")
        print("-" * 34)
        total_cities = 0
        for r in rows:
            total_cities += 1
            print(f"{r['city']:<10}{r['records']:>6}{r['types']:>6}{r['seed_records']:>8}")

        print()
        print(f"数据库中共有城市 {total_cities} 个（含映射外城市）")
        # 映射内城市统计
        mapped = [c for c in CITY_TO_PROVINCE]
        mapped_rows = {r["city"]: r for r in rows if r["city"] in mapped}
        lt20 = [c for c in mapped if c not in mapped_rows or mapped_rows[c]["records"] < 20]
        lt40 = [c for c in mapped if c in mapped_rows and mapped_rows[c]["records"] < 40]
        print(f"映射内城市 {len(mapped)} 个，其中记录数<20 的 {len(lt20)} 个：{lt20[:30]}")
        print(f"记录数<40 的 {len(lt40)} 个")
        avg_rec = sum(mapped_rows[c]["records"] for c in mapped if c in mapped_rows) / len(mapped)
        print(f"映射内城市平均记录数 {avg_rec:.1f}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
