# -*- coding: utf-8 -*-
"""只读探测：数据库 map_data_table 中呼伦贝尔相关数据 + 接口完整返回"""
import asyncio
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import asyncpg
from backend.config import config


async def main():
    conn = await asyncpg.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        user=config.PG_USER,
        password=config.PG_PASSWORD,
        database=config.PG_DB,
    )
    try:
        # 1. 呼伦贝尔相关记录分布
        rows = await conn.fetch(
            """
            SELECT city, count(*)::int AS cnt
            FROM map_data_table
            WHERE city LIKE '%呼伦贝尔%'
            GROUP BY city ORDER BY cnt DESC
            """
        )
        print("=== city LIKE %呼伦贝尔% in map_data_table ===")
        for r in rows:
            print(f"  city={r['city']!r} cnt={r['cnt']}")

        # 2. 内蒙古所有城市分布
        rows2 = await conn.fetch(
            """
            SELECT split_part(city, '·', 1) AS c, count(*)::int AS cnt
            FROM map_data_table
            WHERE city LIKE '%内蒙古%' OR city IN ('呼和浩特','包头','鄂尔多斯','赤峰','呼伦贝尔')
            GROUP BY c ORDER BY cnt DESC LIMIT 40
            """
        )
        print("=== 内蒙古城市分布 (via split_part) ===")
        for r in rows2:
            print(f"  city={r['c']!r} cnt={r['cnt']}")

        # 3. 样例记录
        sample = await conn.fetch(
            """
            SELECT id, city, job_title, source_name, salary_min, salary_max
            FROM map_data_table
            WHERE city LIKE '%呼伦贝尔%'
            LIMIT 5
            """
        )
        print("=== 呼伦贝尔样例记录 ===")
        for r in sample:
            print(f"  id={r['id']} city={r['city']!r} job={r['job_title']!r} src={r['source_name']!r} sal={r['salary_min']}-{r['salary_max']}")

        # 4. 全表城市样本（看城市字段格式）
        sample2 = await conn.fetch("SELECT DISTINCT city FROM map_data_table LIMIT 25")
        print("=== DISTINCT city 样本 ===")
        for r in sample2:
            print(f"  {r['city']!r}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
