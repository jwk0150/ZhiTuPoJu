# -*- coding: utf-8 -*-
"""为全表缺失 city_seed 的记录补齐城市种子（真实数据补写，AI 记录不变）"""
import asyncio

import asyncpg

from backend.city_profile import city_seed

DSN = "postgresql://postgres:123456@127.0.0.1:5432/postgres"


async def main():
    conn = await asyncpg.connect(DSN)
    rows = await conn.fetch(
        "SELECT DISTINCT split_part(city,'·',1) AS c FROM the_total_table "
        "WHERE city IS NOT NULL AND city != ''"
    )
    n = 0
    for r in rows:
        c = r["c"]
        try:
            seed = str(city_seed(c))
        except Exception:
            seed = "0"
        res = await conn.execute(
            "UPDATE the_total_table SET city_seed=$1 "
            "WHERE split_part(city,'·',1)=$2 AND city_seed IS NULL",
            seed, c,
        )
        n += int(res.split()[-1])
    print(f"补齐 city_seed {n} 条")
    left = await conn.fetchval(
        "SELECT COUNT(*) FROM the_total_table WHERE city IS NOT NULL AND city != '' "
        "AND city_seed IS NULL"
    )
    print(f"剩余缺失 city_seed: {left}")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
