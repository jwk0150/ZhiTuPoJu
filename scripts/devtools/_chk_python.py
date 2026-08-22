# -*- coding: utf-8 -*-
"""检查各城市 python 岗位是否存在于完整岗位列表（/city-jobs）"""
import json
import urllib.request
from urllib.parse import quote

BASE = "http://127.0.0.1:5000/api/map"
CITIES = ["周口", "郑州", "洛阳", "商丘", "南昌", "九江", "赣州", "广州", "深圳", "佛山"]


def fetch_city_jobs(city):
    url = BASE + quote(f"/city-jobs/{city}", safe="/")
    with urllib.request.urlopen(url, timeout=30) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return (d.get("data") or {}).get("jobs") or []


for c in CITIES:
    jobs = fetch_city_jobs(c)
    hits = ["%s=%s" % (j["name"], j["count"]) for j in jobs if "python" in j["name"].lower()]
    total = sum(j["count"] for j in jobs)
    print(f"{c}: 共{len(jobs)}个岗位类型, 需求总量≈{total}, python岗位: {hits if hits else '无'}")
