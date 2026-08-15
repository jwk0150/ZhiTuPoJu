# -*- coding: utf-8 -*-
"""验收：抽查北京/上海/广东/江西/江苏/四川/山东/湖北每省3城，验证岗位差异化"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

load_dotenv(Path(__file__).resolve().parent / ".env")

# (省份, [3城])
CHECKS = [
    ("北京", ["北京"]),
    ("上海", ["上海"]),
    ("广东", ["广州", "深圳", "东莞"]),
    ("江西", ["南昌", "九江", "赣州"]),
    ("江苏", ["南京", "苏州", "无锡"]),
    ("四川", ["成都", "绵阳", "乐山"]),
    ("山东", ["济南", "青岛", "临沂"]),
    ("湖北", ["武汉", "襄阳", "黄石"]),
]


async def city_jobs(conn, city: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT job_title, skills, sort_weight, city_seed,
               (source_name = 'ai_seed') AS is_generated
        FROM the_total_table
        WHERE split_part(city, '·', 1) = $1
        ORDER BY sort_weight DESC NULLS LAST, job_title
        """,
        city,
    )
    return [dict(r) for r in rows]


async def main():
    c = await asyncpg.connect(
        host=os.getenv("PG_HOST", "127.0.0.1"),
        port=int(os.getenv("PG_PORT", "5432")),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASSWORD", "123456"),
        database=os.getenv("PG_DB", "postgres"),
    )
    out = []
    for prov, cities in CHECKS:
        out.append(f"\n===== {prov} =====")
        data = {}
        for city in cities:
            jobs = await city_jobs(c, city)
            data[city] = jobs
            titles = [j["job_title"] for j in jobs]
            seeds = {j["city_seed"] for j in jobs}
            real = sum(1 for j in jobs if not j["is_generated"])
            gen = len(jobs) - real
            sw_ok = all(j["sort_weight"] is not None for j in jobs)
            skills = [j["skills"] for j in jobs if j["skills"]]
            out.append(
                f"[{city}] 共{len(jobs)}条(真实{real}/生成{gen}) 类型{len(set(titles))}种 "
                f"city_seed去重{len(seeds)} sort_weight全有={sw_ok}"
            )
            out.append(f"   TOP8: {titles[:8]}")
        # 同省城市重合率
        if len(cities) > 1:
            import itertools
            for a, b in itertools.combinations(cities, 2):
                ta = {j["job_title"] for j in data[a]}
                tb = {j["job_title"] for j in data[b]}
                inter = len(ta & tb)
                union = len(ta | tb)
                rate = inter / union if union else 0
                out.append(f"   {a}×{b}: 类型重合率 {rate:.0%} (交集{inter}/并集{union})")
    txt = "\n".join(out)
    print(txt)
    with open("_verify_profiles_out.txt", "w", encoding="utf-8") as f:
        f.write(txt + "\n")
    await c.close()


if __name__ == "__main__":
    asyncio.run(main())
