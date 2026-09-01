# -*- coding: utf-8 -*-
"""临时验证：fetch_city_jobs_full 函数级调用（南昌/上海/中山）"""
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
    for city in ["南昌市", "上海", "中山", "三亚"]:
        data = await svc.fetch_city_jobs_full(conn, city, ensure_min=20)
        jobs = data["jobs"]
        names = [j["name"] for j in jobs]
        print(f"\n== {city} ==")
        print(f"  totalJobs={data['totalJobs']} isSupplemented={data['isSupplemented']} "
              f"supplementedCount={data.get('supplementedCount', 0)}")
        print(f"  唯一标题数: {len(set(names))} / {len(jobs)}")
        avg = sum(j['avgSalary'] or 0 for j in jobs) / max(len(jobs), 1)
        print(f"  平均薪资: {avg:.0f} 元/月")
        for j in jobs[:6]:
            print(f"    {j['name']} cnt={j['count']} salary={j['avgSalary']} isReal={j['isReal']}")
    await conn.close()


asyncio.run(main())
