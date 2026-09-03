# -*- coding: utf-8 -*-
"""只读探测：打印前端实际请求接口的完整返回"""
import json
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:5000/api/map/"

paths = [
    f"city/{urllib.parse.quote('内蒙古')}/{urllib.parse.quote('呼伦贝尔')}",
    f"city-jobs/{urllib.parse.quote('呼伦贝尔')}",
]

for p in paths:
    try:
        with urllib.request.urlopen(BASE + p, timeout=30) as r:
            raw = r.read().decode("utf-8")
        d = json.loads(raw)
        data = d.get("data") if isinstance(d, dict) else None
        print("=" * 30, p)
        if isinstance(data, dict):
            print("  keys:", list(data.keys()))
            print("  totalJobs:", data.get("totalJobs"))
            print("  avgSalary:", data.get("avgSalary"))
            tj = data.get("topJobs") or data.get("jobs") or []
            print("  topJobs len:", len(tj))
            print("  topJobs[0]:", json.dumps(tj[0], ensure_ascii=False)[:400] if tj else None)
        else:
            print("  FULL:", raw[:800])
    except Exception as e:
        print("ERR", p, repr(e)[:200])
