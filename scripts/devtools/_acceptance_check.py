"""验收：8省(市)×3城抽查——数量不同/类型不同/排序不同/技能组合不同/数据稳定"""
import asyncio
import json

import asyncpg

from backend.mappings import CITY_TO_PROVINCE

_OUT = open("_acceptance_out.txt", "w", encoding="utf-8")
import sys

sys.stdout = _OUT

DSN = "postgresql://postgres:123456@127.0.0.1:5432/postgres"

# 验收城市：北京/上海/广东/江西/江苏/四川/山东/湖北
CITY_GROUPS = {
    "北京": ["北京"],
    "上海": ["上海"],
    "广东": ["广州", "深圳", "佛山"],
    "江西": ["南昌", "九江", "赣州"],
    "江苏": ["南京", "苏州", "无锡"],
    "四川": ["成都", "绵阳", "南充"],
    "山东": ["济南", "青岛", "烟台"],
    "湖北": ["武汉", "宜昌", "襄阳"],
}


async def main():
    conn = await asyncpg.connect(DSN)
    info = {}

    for prov, cities in CITY_GROUPS.items():
        for c in cities:
            rows = await conn.fetch(
                """SELECT job_title, skills, sort_weight, source_name
                   FROM the_total_table
                   WHERE split_part(city,'·',1)=$1
                   ORDER BY sort_weight DESC NULLS LAST""",
                c,
            )
            count = len(rows)
            types = len({r["job_title"] for r in rows})
            top10 = [(r["job_title"], round(r["sort_weight"] or 0, 2)) for r in rows[:10]]
            # TOP5 岗位的技能组合
            top5_skills = {}
            for r in rows[:5]:
                top5_skills[r["job_title"]] = (r["skills"] or "").strip()
            info[c] = {
                "prov": prov,
                "count": count,
                "types": types,
                "top10": top10,
                "top5_skills": top5_skills,
            }

    print("== 验收报告 ==")
    print(f"{'省市':<6}{'城市':<8}{'岗位数':<7}{'类型数':<6}{'TOP10(岗位@sort_weight)'}")
    for prov, cities in CITY_GROUPS.items():
        for c in cities:
            i = info[c]
            top = " | ".join(f"{t}@{w}" for t, w in i["top10"][:5])
            print(f"{prov:<6}{c:<8}{i['count']:<7}{i['types']:<6}{top}")

    print("\n== 1) 岗位数量不同 ==")
    counts = {c: info[c]["count"] for c in info}
    print(f"抽查 {len(counts)} 城，数量集合大小 = {len(set(counts.values()))}/{len(counts)}")
    same_cnt = [(a, b) for a in counts for b in counts if a < b and counts[a] == counts[b]]
    print(f"数量相同的城市对: {len(same_cnt)}  {same_cnt[:10]}")

    print("\n== 2) 岗位类型不同 ==")
    sets = {}
    for c in info:
        rows = await conn.fetch(
            "SELECT DISTINCT job_title FROM the_total_table WHERE split_part(city,'·',1)=$1", c
        )
        sets[c] = {r["job_title"] for r in rows}
    same_type = []
    for a in sets:
        for b in sets:
            if a < b and sets[a] == sets[b]:
                same_type.append((a, b))
    print(f"类型集合完全相同的城市对: {len(same_type)}  {same_type[:10]}")
    # 组内类型重合率
    print("\n组内(同省市)岗位类型重合率：")
    for prov, cities in CITY_GROUPS.items():
        if len(cities) < 2:
            continue
        line = []
        for i in range(len(cities)):
            for j in range(i + 1, len(cities)):
                a, b = cities[i], cities[j]
                inter = len(sets[a] & sets[b])
                ov = inter / min(len(sets[a]), len(sets[b]))
                line.append(f"{a}x{b}={ov:.2f}({inter}/{min(len(sets[a]),len(sets[b]))})")
        print(f"  {prov}: " + "  ".join(line))

    print("\n== 3) 排序不同 ==")
    same_order = 0
    for prov, cities in CITY_GROUPS.items():
        if len(cities) < 2:
            continue
        for i in range(len(cities)):
            for j in range(i + 1, len(cities)):
                a, b = cities[i], cities[j]
                seq_a = [t for t, _ in info[a]["top10"]]
                seq_b = [t for t, _ in info[b]["top10"]]
                if seq_a == seq_b:
                    same_order += 1
                    print(f"  ⚠ 排序相同: {a} == {b}  {seq_a}")
    print(f"TOP10 排序完全相同的城市对: {same_order}")

    print("\n== 4) 技能组合不同 ==")
    diff = 0
    total = 0
    for prov, cities in CITY_GROUPS.items():
        if len(cities) < 2:
            continue
        for i in range(len(cities)):
            for j in range(i + 1, len(cities)):
                a, b = cities[i], cities[j]
                common = set(info[a]["top5_skills"]) & set(info[b]["top5_skills"])
                for t in common:
                    total += 1
                    if info[a]["top5_skills"][t] != info[b]["top5_skills"][t]:
                        diff += 1
                    else:
                        print(f"  ⚠ 技能相同 {t}: {a}=={b} -> {info[a]['top5_skills'][t]}")
    print(f"同岗位跨城技能比较 {total} 次，不同 {diff} 次，相同 {total - diff} 次")

    print("\n== 5) 数据稳定 ==")
    seed_cnt = 0
    for c in info:
        r = await conn.fetchrow(
            """SELECT city_seed, COUNT(*) FILTER (WHERE city_seed IS NOT NULL) AS sd,
                      COUNT(*) AS n
               FROM the_total_table WHERE split_part(city,'·',1)=$1 GROUP BY city_seed""",
            c,
        )
        if r and r["sd"] == r["n"] and r["city_seed"]:
            seed_cnt += 1
    print(f"city_seed 完整覆盖的城市: {seed_cnt}/{len(info)}")

    await conn.close()
    _OUT.close()


if __name__ == "__main__":
    asyncio.run(main())
