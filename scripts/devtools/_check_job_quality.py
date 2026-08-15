# -*- coding: utf-8 -*-
"""数据质量检查：城市岗位数量 / 类型数 / 重复率 / 排序差异

用法：
    python _check_job_quality.py          # 全部映射城市
    python _check_job_quality.py 江西      # 指定省份
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.mappings import CITY_TO_PROVINCE
from backend.services import _city_order_score, _norm_city_for_query


async def main():
    target_prov = None
    if len(sys.argv) > 1:
        target_prov = sys.argv[1]

    conn = await asyncpg.connect(
        host="127.0.0.1", port=5432, user="postgres",
        password="123456", database="postgres",
    )
    try:
        if target_prov:
            cities = [c for c, p in CITY_TO_PROVINCE.items() if p == target_prov]
            print(f"== 省份 {target_prov} ==")
        else:
            cities = list(CITY_TO_PROVINCE.keys())

        rows = await conn.fetch("""
            SELECT split_part(city,'·',1) AS city, job_title,
                   count(*)::int AS cnt,
                   bool_or(source_name='ai_seed') AS is_seed
            FROM the_total_table
            WHERE city IS NOT NULL AND city <> ''
              AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY split_part(city,'·',1), job_title
        """)

        by_city = {}
        for r in rows:
            by_city.setdefault(r["city"], []).append(r)

        print(f"{'城市':<10}{'记录':>6}{'类型':>6}{'ai_seed':>9}{'达标':>5}")
        print("-" * 42)
        lt20 = []
        for c in cities:
            short = _norm_city_for_query(c)
            recs = by_city.get(short) or []
            total = sum(r["cnt"] for r in recs)
            types_ = len(recs)
            seed_cnt = sum(r["cnt"] for r in recs if r["is_seed"])
            ok = "OK" if total >= 20 and types_ >= 2 else "!!"
            if ok == "!!":
                lt20.append(short)
            print(f"{short:<12}{total:>6}{types_:>6}{seed_cnt:>9}{ok:>5}")

        print()
        if lt20:
            print(f"[未达标] {len(lt20)} 个城市：{lt20}")
        else:
            print("[达标] 所有城市记录数 >= 20 且类型 >= 2")

        # 排序差异对比（南昌/九江/赣州 + 前 3 大城市）
        demo = ["南昌", "九江", "赣州", "深圳", "杭州", "北京"]
        demo = [c for c in demo if c in cities or _norm_city_for_query(c) in by_city]
        print()
        print("== 城市岗位 TOP8 排序对比（稳定排序） ==")
        orders = {}
        for c in demo:
            short = _norm_city_for_query(c)
            recs = by_city.get(short) or []
            max_cnt = max((r["cnt"] for r in recs), default=0)
            recs.sort(key=lambda r: _city_order_score(short, r["job_title"], r["cnt"], max_cnt))
            top = [r["job_title"] for r in recs[:8]]
            orders[short] = top
            print(f"{short:<6}: " + " > ".join(top))
        if len(orders) >= 2:
            keys = list(orders.keys())
            same = all(orders[keys[0]] == orders[k] for k in keys[1:])
            print(f"\n[排序差异] {'所有城市完全一致（异常）' if same else '不同城市排序存在差异（正常）'}")
            # 集合差异
            sets = {k: set(orders[k]) for k in keys}
            identical = all(sets[keys[0]] == sets[k] for k in keys[1:])
            print(f"[集合差异] {'TOP8 岗位集合完全相同（异常）' if identical else 'TOP8 岗位集合存在差异（正常）'}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
