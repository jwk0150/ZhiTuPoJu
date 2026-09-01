# -*- coding: utf-8 -*-
import asyncio
import asyncpg

from backend.services import _norm_city_for_query


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432, user="postgres",
                                 password="123456", database="postgres")
    for name in ["验证测试市", "测试城"]:
        short = _norm_city_for_query(name)
        deleted = await conn.execute(
            "DELETE FROM the_total_table WHERE source_name='ai_seed' AND split_part(city,'·',1)=$1", short)
        print(f"{name} -> {short} -> {deleted}")
    await conn.close()


asyncio.run(main())
