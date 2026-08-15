# -*- coding: utf-8 -*-
"""冒烟测试：城市画像确定性 + 差异化（南昌/九江/赣州 + 抽查省份）"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.city_profile import (
    build_city_profile,
    pick_diverse_titles,
    city_skill_variant,
    city_seed,
)

CITIES = [("南昌", "江西"), ("九江", "江西"), ("赣州", "江西"),
          ("北京", "北京"), ("上海", "上海"), ("广州", "广东"), ("深圳", "广东"),
          ("苏州", "江苏"), ("无锡", "江苏"), ("成都", "四川"), ("绵阳", "四川"),
          ("济南", "山东"), ("青岛", "山东"), ("武汉", "湖北"), ("襄阳", "湖北")]

lines = []
lines.append("== citySeed（同城稳定、城城不同）==")
seeds = {}
for c, _ in CITIES:
    s1 = city_seed(c)
    s2 = city_seed(c)
    seeds[c] = s1
    lines.append(f"{c}: seed={s1} 稳定={'OK' if s1 == s2 else 'FAIL'}")
lines.append(f"去重后 {len(set(seeds.values()))}/{len(CITIES)} 个不同 seed")

lines.append("")
lines.append("== 画像产业分层 ==")
for c, _ in CITIES:
    p = build_city_profile(c)
    lines.append(f"{c}[{p['tier']}] 核心={p['core_industries']} 次核心={p['secondary_industries']} 特色={p['feature_industries']}")

lines.append("")
lines.append("== 分层采样 30 个岗位（前10 + 去重数） ==")
profiles = {c: build_city_profile(c) for c, _ in CITIES}
title_sets = {}
for c, _ in CITIES:
    rng = random.Random(profiles[c]["seed"] + 1)
    titles = pick_diverse_titles(profiles[c], set(), 30, rng)
    title_sets[c] = set(titles)
    lines.append(f"{c}: 前10={titles[:10]}")

lines.append("")
lines.append("== 同省城市岗位重合率（越低越差异化）==")
import itertools
for prov in ["江西", "广东", "江苏", "四川", "山东", "湖北"]:
    cities = [c for c, p in CITIES if p == prov]
    for a, b in itertools.combinations(cities, 2):
        inter = len(title_sets[a] & title_sets[b])
        union = len(title_sets[a] | title_sets[b])
        rate = inter / union if union else 0
        lines.append(f"{a} × {b}: 重合率 {rate:.0%} ({inter}/{union})")

lines.append("")
lines.append("== 同岗不同城技能差异（Java开发工程师） ==")
for c in ["南昌", "九江", "赣州"]:
    skills = city_skill_variant("Java开发工程师", profiles[c])
    lines.append(f"{c}: {skills}")

out = "\n".join(lines)
print(out)
with open("_smoke_profile_out.txt", "w", encoding="utf-8") as f:
    f.write(out)
