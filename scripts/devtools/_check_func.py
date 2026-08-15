# -*- coding: utf-8 -*-
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.services import fetch_city_detail


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432, user="postgres",
                                 password="123456", database="postgres")
    d = await fetch_city_detail(conn, "江西", "南昌市")
    print("totalJobs =", d["totalJobs"])
    print("topJobs   =", len(d["topJobs"]))
    print("keys      =", sorted(d.keys()))
    print("top5      =", [j["name"] for j in d["topJobs"][:5]])
    await conn.close()


asyncio.run(main())
