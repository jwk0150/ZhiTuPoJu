"""数据诊断：统计各城市岗位数量/类型/重复率/来源占比，定位"全国各市岗位高度重复"根因"""
import asyncio
import sys
from collections import Counter, defaultdict

import asyncpg

from backend.mappings import CITY_TO_PROVINCE

_OUT = open("_diag_city_profiles_out.txt", "w", encoding="utf-8")
sys.stdout = _OUT

DSN = "postgresql://postgres:123456@127.0.0.1:5432/postgres"


async def main():
    conn = await asyncpg.connect(DSN)

    # 城市分布（归一化 split_part）
    rows = await conn.fetch(
        """SELECT split_part(city,'·',1) AS c,
                  COUNT(*)::int AS cnt,
                  COUNT(DISTINCT job_title)::int AS job_types,
                  COUNT(*) FILTER (WHERE source_name='ai_seed')::int AS ai_cnt,
                  COUNT(*) FILTER (WHERE source_name IS DISTINCT FROM 'ai_seed')::int AS real_cnt
           FROM the_total_table
           WHERE city IS NOT NULL AND city != ''
           GROUP BY 1
           ORDER BY cnt DESC"""
    )
    city_rows = {r["c"]: r for r in rows}
    print(f"== 城市总数: {len(city_rows)} ==")
    print(f"{'城市':<8}{'省份':<6}{'岗位数':<7}{'类型数':<6}{'AI数':<7}{'真实数':<7}{'AI占比%'}")
    for r in rows:
        c = r["c"]
        prov = CITY_TO_PROVINCE.get(c, "?")
        ai_pct = round(r["ai_cnt"] / r["cnt"] * 100) if r["cnt"] else 0
        print(f"{c:<8}{prov:<6}{r['cnt']:<7}{r['job_types']:<6}{r['ai_cnt']:<7}{r['real_cnt']:<7}{ai_pct}")

    # 每城市岗位集合
    print("\n== 岗位集合分析 ==")
    city_sets = {}
    for r in rows:
        c = r["c"]
        titles = await conn.fetch(
            "SELECT DISTINCT job_title FROM the_total_table WHERE split_part(city,'·',1)=$1", c
        )
        city_sets[c] = {t["job_title"] for t in titles}

    prov_cities = defaultdict(list)
    for c in city_sets:
        prov = CITY_TO_PROVINCE.get(c, "?")
        prov_cities[prov].append(c)

    # 同省内两两 Jaccard / 重合率 Top 20
    print("\n== 同省内城市岗位集合重合率 Top 20 ==")
    sims = []
    for prov, cities in prov_cities.items():
        if len(cities) < 2:
            continue
        for i in range(len(cities)):
            for j in range(i + 1, len(cities)):
                a, b = cities[i], cities[j]
                sa, sb = city_sets[a], city_sets[b]
                inter = sa & sb
                union = sa | sb
                jac = len(inter) / len(union) if union else 0
                overlap = len(inter) / min(len(sa), len(sb)) if sb else 0
                sims.append((overlap, jac, prov, a, b, len(sa), len(sb), len(inter)))
    sims.sort(reverse=True)
    for ov, jac, prov, a, b, la, lb, inter in sims[:20]:
        print(f"{prov:<5}{a:<8}x{b:<8} 重合率={ov:.2f} Jaccard={jac:.2f} ({inter}/{min(la,lb)}) 岗位数 {la}/{lb}")

    # 完全相同的城市对
    print("\n== 岗位集合完全相同的城市对（小集合>5）==")
    same_pairs = [(p, a, b) for ov, j, p, a, b, la, lb, i in sims if ov >= 0.95 and min(la, lb) > 5]
    for p, a, b in same_pairs[:40]:
        print(f"{p:<5}{a} == {b}")
    print(f"完全相同城市对总数: {len(same_pairs)}")

    # 高频岗位出现城市数 Top 20
    print("\n== 出现城市数最多的岗位 Top 20 ==")
    title_city = Counter()
    for c, s in city_sets.items():
        for t in s:
            title_city[t] += 1
    total_cities = len(city_sets)
    for t, n in title_city.most_common(20):
        print(f"{n:>3}/{total_cities} 城市  {t}")

    # 每城市高频岗位占比 Top 15（"全国同款"占比）
    print('\n== 每城市"全国同款岗位"(出现于>50%城市)占比 Top 15 ==')
    hot_titles = {t for t, n in title_city.items() if n > total_cities * 0.5}
    ratios = []
    for c, s in city_sets.items():
        if not s:
            continue
        hot = len(s & hot_titles)
        ratios.append((hot / len(s), c, len(s), hot))
    ratios.sort(reverse=True)
    for ratio, c, total, hot in ratios[:15]:
        print(f"{c:<8} 同款占比 {ratio:.2f} ({hot}/{total})")

    # 省画像一致性
    print("\n== 各省城市画像一致性（城市岗位集合 vs 省首城）==")
    for prov, cities in sorted(prov_cities.items()):
        if len(cities) < 2:
            continue
        ref = city_sets[cities[0]]
        same = sum(1 for c in cities[1:] if city_sets[c] == ref)
        avg = sum(len(city_sets[c]) for c in cities) / len(cities)
        print(f"{prov:<6} 城市数={len(cities):<3} 平均岗位类型数={avg:<6.1f} 与首城完全一致数={same}")

    await conn.close()
    _OUT.close()


if __name__ == "__main__":
    asyncio.run(main())
