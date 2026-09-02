# -*- coding: utf-8 -*-
"""临时验证：fetch_city_detail / fetch_city_tech_graph"""
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
    try:
        cd = await svc.fetch_city_detail(conn, "江西", "南昌市")
        print("fetch_city_detail OK")
        print("  keys:", list(cd.keys()))
        print("  totalJobs:", cd.get("totalJobs"), "topJobs数:", len(cd.get("topJobs", [])))
        print("  avgSalary:", cd.get("avgSalary"))
        print("  topIndustries:", cd.get("topIndustries", [])[:5])
        for j in cd.get("topJobs", [])[:5]:
            print("    ", j)
    except Exception as e:
        print("fetch_city_detail ERROR:", type(e).__name__, e)
        import traceback
        traceback.print_exc()

    try:
        tg = await svc.fetch_city_tech_graph(conn, "南昌市")
        print("\nfetch_city_tech_graph OK")
        print("  keys:", list(tg.keys()))
        print("  techNodes:", len(tg.get("techNodes", [])), "nodes:", len(tg.get("nodes", [])))
        print("  edges:", len(tg.get("edges", [])))
    except Exception as e:
        print("fetch_city_tech_graph ERROR:", type(e).__name__, e)
        import traceback
        traceback.print_exc()

    await conn.close()


asyncio.run(main())
