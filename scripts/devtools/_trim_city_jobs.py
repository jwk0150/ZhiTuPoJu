# -*- coding: utf-8 -*-
"""非大城市岗位规模校准：删低频类型（保真实类型+高频类型）→ 回补记录数（热门类型多条记录）

步骤：
1. 以"真实数据（非 ai_seed）"评估城市 tier → (target_records, target_types)
2. 若类型数 > target_types：删除低频类型（真实类型永远保留）
3. 调用 ensure_city_min_jobs 回补记录数到 target_records（热门岗位多条记录、参数各不相同）

用法：python _trim_city_jobs.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.mappings import CITY_TO_PROVINCE
from backend.job_pool import MAJOR_CITIES, city_scale
from backend.seed_city_jobs import _norm_city_for_query, ensure_city_min_jobs


async def main():
    conn = await asyncpg.connect(
        host="127.0.0.1", port=5432, user="postgres",
        password="123456", database="postgres",
    )
    try:
        total_deleted = 0
        total_added = 0
        touched = 0
        print(f"{'城市':<12}{'真实':>5}{'类型':>6}{'目标类型':>8}{'删类型':>6}{'删记录':>6}{'回补':>6}{'最终':>6}")
        print("-" * 62)
        for city in list(CITY_TO_PROVINCE.keys()):
            short = _norm_city_for_query(city)
            if short in MAJOR_CITIES:
                continue

            # 1) 真实数据规模 → 评估 tier
            real = await conn.fetch(
                """SELECT count(*)::int AS recs,
                          count(DISTINCT job_title)::int AS types
                   FROM the_total_table
                   WHERE source_name <> 'ai_seed'
                     AND (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')""",
                short,
            )
            real_recs = real[0]["recs"]
            target_records, target_types = city_scale(short, real_recs, real[0]["types"])

            # 2) 类型级统计
            type_rows = await conn.fetch(
                """SELECT job_title, count(*)::int AS cnt,
                          bool_or(source_name <> 'ai_seed') AS is_real
                   FROM the_total_table
                   WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')
                   GROUP BY job_title
                   ORDER BY cnt DESC, job_title""",
                short,
            )

            # 2.1) 删低频类型（真实类型保底保留）
            cur_types = len(type_rows)
            real_types = [r for r in type_rows if r["is_real"]]
            drop_count = 0
            if cur_types > target_types:
                keep_count = max(target_types, len(real_types))
                keep = set(r["job_title"] for r in real_types)
                for r in type_rows:
                    if len(keep) >= keep_count:
                        break
                    if not r["is_real"]:
                        keep.add(r["job_title"])
                drop_titles = [r["job_title"] for r in type_rows if r["job_title"] not in keep]
                if drop_titles:
                    # 删除低频类型（这些类型基本都只有 1 条记录）
                    for t in drop_titles:
                        res = await conn.execute(
                            """DELETE FROM the_total_table
                               WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')
                                 AND job_title=$2""",
                            short, t,
                        )
                        try:
                            total_deleted += int(res.split()[-1])
                            drop_count += 1
                        except Exception:
                            pass

            # 3) 回补记录数（热门类型多条记录）
            before_recs = (await conn.fetchval(
                """SELECT count(*) FROM the_total_table
                   WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')""",
                short,
            )) or 0
            added = await ensure_city_min_jobs(conn, short)
            total_added += added
            after_recs = (await conn.fetchval(
                """SELECT count(*) FROM the_total_table
                   WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')""",
                short,
            )) or 0
            if added or drop_count:
                touched += 1
                print(f"{short:<14}{real_recs:>5}{cur_types:>6}{target_types:>8}{drop_count:>6}{before_recs:>6}{added:>6}{after_recs:>6}")

        print("-" * 62)
        print(f"校准 {touched} 个城市：删除 {total_deleted} 条，回补 {total_added} 条")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
