# -*- coding: utf-8 -*-
"""临时验证：fetch_city_tech_graph 的 categories 结构"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import asyncio
import asyncpg

import backend.services as svc


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432,
                                 user="postgres", password="123456",
                                 database="postgres")
    for city in ["南昌市", "上海"]:
        tg = await svc.fetch_city_tech_graph(conn, city)
        cats = tg["categories"]
        print(f"\n== {city} 技术图谱 ==")
        print(f"  centerJob={tg['centerJob']} uniqueTitles={tg['uniqueTitles']} "
              f"maxFrequency={tg['maxFrequency']} isSupplemented={tg['isSupplemented']}")
        tech_total = 0
        for c in cats:
            tech_total += len(c["technologies"])
            print(f"  [{c['name']}] {len(c['technologies'])} 项技术")
            for t in c["technologies"][:3]:
                print(f"      {t['name']} freq={t['frequency']}")
        print(f"  技术总数: {tech_total}")
    await conn.close()


asyncio.run(main())
