# -*- coding: utf-8 -*-
"""
阶段二诊断脚本：盘点全国各市岗位数据现状
输出：
1. 每市：总记录数 / 真实记录数 / ai_seed 记录数 / 岗位类型数 / 类型是否充足
2. 全国 TOP30 高频岗位标题（出现在多少城市、总记录数）——找"全国同款"证据
3. 抽查城市两两 Jaccard 重复率
"""
import asyncio
import sys
from collections import Counter, defaultdict

import asyncpg

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432,
                                 user="postgres", password="123456",
                                 database="postgres")

    # 1. 每市统计
    rows = await conn.fetch("""
        SELECT split_part(city,'·',1) AS c,
               count(*)::int AS total,
               count(*) FILTER (WHERE source_name='ai_seed')::int AS ai_cnt,
               count(*) FILTER (WHERE source_name IS DISTINCT FROM 'ai_seed')::int AS real_cnt,
               count(DISTINCT job_title)::int AS types
        FROM the_total_table
        WHERE city IS NOT NULL AND city <> ''
        GROUP BY 1 ORDER BY 1
    """)
    print(f"== 共 {len(rows)} 个城市 ==")
    print(f"{'城市':<8}{'总记录':<8}{'真实':<8}{'ai_seed':<8}{'类型数':<6}状态")
    low = []
    no_data = []
    for r in rows:
        c = r["c"]
        status = "OK" if r["types"] >= 20 else ("低" if r["types"] >= 10 else "极低")
        if r["types"] < 20:
            low.append((c, r["types"]))
        if r["total"] == 0:
            no_data.append(c)
        print(f"{c:<8}{r['total']:<8}{r['real_cnt']:<8}{r['ai_cnt']:<8}{r['types']:<6}{status}")

    print(f"\n== 类型数<20 的城市 {len(low)} 个 ==")
    print(low)
    print(f"\n== 无任何数据城市 {len(no_data)} 个 ==")
    print(no_data)

    # 2. 全国 TOP30 高频岗位标题
    title_rows = await conn.fetch("""
        SELECT job_title, count(DISTINCT split_part(city,'·',1))::int AS city_n,
               count(*)::int AS rec_n
        FROM the_total_table
        WHERE job_title IS NOT NULL AND job_title <> ''
        GROUP BY job_title
        HAVING count(DISTINCT split_part(city,'·',1)) >= 5
        ORDER BY city_n DESC, rec_n DESC
        LIMIT 40
    """)
    print("\n== 全国高频岗位标题 TOP40（按出现城市数）==")
    print(f"{'岗位标题':<24}{'城市数':<8}{'总记录'}")
    for r in title_rows:
        print(f"{r['job_title']:<24}{r['city_n']:<8}{r['rec_n']}")

    # 3. 抽查城市：每市 TOP10 岗位类型
    check_cities = ["北京", "上海", "广州", "深圳", "南昌", "九江", "赣州",
                    "南京", "苏州", "无锡", "成都", "绵阳", "济南", "青岛",
                    "武汉", "襄阳", "郑州", "长沙", "杭州", "宁波"]
    print("\n== 抽查城市岗位类型分布（TOP12）==")
    city_titles = {}
    for c in check_cities:
        trows = await conn.fetch("""
            SELECT job_title, count(*)::int AS cnt
            FROM the_total_table
            WHERE split_part(city,'·',1)=$1 AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY job_title ORDER BY cnt DESC LIMIT 12
        """, c)
        city_titles[c] = {r["job_title"] for r in trows}
        top = " / ".join(f"{r['job_title']}×{r['cnt']}" for r in trows[:12])
        print(f"\n[{c}]")
        print(f"  {top}")

    # 4. 城市两两 Jaccard 相似度（抽查城市，前 6 城市互算 + 江西三城互算）
    def jac(a, b):
        if not a or not b:
            return 0.0
        return len(a & b) / len(a | b)

    print("\n== 抽查城市两两 Jaccard（岗位类型集合相似度，1.0=完全相同）==")
    pairs = [("北京", "上海"), ("北京", "广州"), ("广州", "深圳"),
             ("南昌", "九江"), ("南昌", "赣州"), ("九江", "赣州"),
             ("南京", "苏州"), ("成都", "绵阳"), ("武汉", "襄阳"),
             ("南昌", "南京"), ("南昌", "成都")]
    for a, b in pairs:
        s = jac(city_titles.get(a, set()), city_titles.get(b, set()))
        print(f"  {a} vs {b}: {s:.2f}")

    await conn.close()


asyncio.run(main())
