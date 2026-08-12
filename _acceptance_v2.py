# -*- coding: utf-8 -*-
"""最终验收：抽查 河南/江西/广东 各城市岗位分析数据（临时脚本）"""
import json
import urllib.request
from urllib.parse import quote

BASE = "http://127.0.0.1:5000/api/map"


def fetch_city_jobs(city):
    path = f"/city-jobs/{city}"
    url = BASE + quote(path, safe="/")
    with urllib.request.urlopen(url, timeout=30) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    data = d.get("data") or {}
    jobs = data.get("jobs") or []
    return jobs


def fetch_city_detail(prov, city):
    path = f"/city/{prov}/{city}"
    url = BASE + quote(path, safe="/")
    with urllib.request.urlopen(url, timeout=30) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    data = d.get("data") or {}
    top = data.get("topJobs") or []
    return top


CITIES = ["周口", "郑州", "洛阳", "商丘", "南昌", "九江", "赣州", "广州", "深圳", "佛山"]
PROV = {"周口": "河南", "郑州": "河南", "洛阳": "河南", "商丘": "河南",
        "南昌": "江西", "九江": "江西", "赣州": "江西",
        "广州": "广东", "深圳": "广东", "佛山": "广东"}

print("=" * 100)
print("一、岗位分析 TOP 列表（顺序 + 数量）")
print("=" * 100)
orders = {}
for c in CITIES:
    top = fetch_city_detail(PROV[c], c)
    line = " | ".join(f"{j['name']}({j['count']})" for j in top[:8])
    print(f"{c}: {line}")
    orders[c] = [j["name"] for j in top[:8]]

print()
print("=" * 100)
print("二、验收检查")
print("=" * 100)

# ① 岗位顺序：不同城市不能完全一样
print("\n① 岗位顺序对比（前8名）：")
all_same = True
for i in range(len(CITIES)):
    for j in range(i + 1, len(CITIES)):
        if orders[CITIES[i]] == orders[CITIES[j]]:
            print(f"  !! {CITIES[i]} 与 {CITIES[j]} 前8名完全一致")
            all_same = False
print("  全部不同 ✓" if all_same else "  存在相同城市 ✗")

# ②③ 数量 ≥20、数量波动
print("\n② 岗位数量检查（每个岗位 ≥20，且有波动）：")
min_c = min_max = 10**9
violations = []
for c in CITIES:
    top = fetch_city_detail(PROV[c], c)
    counts = [j["count"] for j in top]
    mn, mx = min(counts), max(counts)
    min_c, min_max = min(min_c, mn), min(min_max, mx)
    low = [j["name"] for j in top if j["count"] < 20]
    if low:
        violations.append((c, low))
    print(f"  {c}: min={mn} max={mx} distinct={len(set(counts))}")
if violations:
    print("  !! 存在 <20 的岗位:", violations)
else:
    print("  所有岗位 ≥20 ✓")

# ③ 同城不同岗位数量不同
print("\n③ 同城内部岗位数量差异（应存在波动，不能全部相同）：")
for c in CITIES:
    top = fetch_city_detail(PROV[c], c)
    counts = [j["count"] for j in top]
    if len(set(counts)) <= 1:
        print(f"  !! {c} 所有岗位数量相同: {counts}")
    else:
        print(f"  {c}: 有 {len(set(counts))} 种不同数量 ✓")

# ④ 城市规模影响数量
print("\n④ 城市规模影响（深圳/广州 vs 周口/商丘，总体均值应明显更高）：")
def avg_counts(c):
    return sum(j["count"] for j in fetch_city_detail(PROV[c], c)[:8]) / 8
big = [avg_counts(c) for c in ["深圳", "广州", "郑州"]]
small = [avg_counts(c) for c in ["周口", "商丘", "九江"]]
print(f"  大城市(深圳/广州/郑州)平均: {sum(big)/3:.1f}")
print(f"  小城市(周口/商丘/九江)平均: {sum(small)/3:.1f}")
print("  大城市明显更高 ✓" if sum(big) / 3 > sum(small) / 3 * 1.3 else "  差异不够明显 ⚠")

# ⑤ 同一个岗位在不同城市数量不同
print("\n⑤ 同岗位跨城数量对比（python 开发岗位，大小写不敏感）：")
for c in CITIES:
    top = fetch_city_detail(PROV[c], c)
    hits = ["%s=%s" % (j["name"], j["count"]) for j in top if "python" in j["name"].lower()]
    if hits:
        print(f"  {c}: {hits[:2]}")
    else:
        print(f"  {c}: 无 python 岗位（在 top20 中）")

# ⑥ 稳定性（两次请求对比）
print("\n⑥ 数据稳定性（重复请求对比）：")
stable = True
for c in CITIES:
    a = [(j["name"], j["count"]) for j in fetch_city_detail(PROV[c], c)[:8]]
    b = [(j["name"], j["count"]) for j in fetch_city_detail(PROV[c], c)[:8]]
    if a != b:
        stable = False
        print(f"  !! {c} 两次结果不一致")
print("  所有城市两次请求完全一致 ✓" if stable else "  存在不稳定 ✗")

# ⑦ 城市间真正不同（岗位列表 + 数量都不全同）
print("\n⑦ 城市间综合差异（岗位+数量 组合）：")
for c in CITIES:
    s = set((j["name"], j["count"]) for j in fetch_city_detail(PROV[c], c))
    print(f"  {c}: {len(s)} 个不同的(岗位,数量)组合")
