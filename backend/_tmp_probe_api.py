# -*- coding: utf-8 -*-
"""只读探测：测试城市点击相关 API（不改动任何数据）"""
import json
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:5000/api/map/"
CITY = "呼伦贝尔"
CITY_FULL = "呼伦贝尔市"
PROV = "内蒙古"

paths = [
    f"city-jobs/{urllib.parse.quote(CITY)}",
    f"city-jobs/{urllib.parse.quote(CITY_FULL)}",
    f"city/{urllib.parse.quote(PROV)}/{urllib.parse.quote(CITY_FULL)}",
    f"city-preview/{urllib.parse.quote(PROV)}/{urllib.parse.quote(CITY_FULL)}",
    f"cities/{urllib.parse.quote('内蒙古')}",
]

for p in paths:
    try:
        with urllib.request.urlopen(BASE + p, timeout=25) as r:
            raw = r.read().decode("utf-8")
        print("OK  ", p, "=>", raw[:500])
    except Exception as e:
        print("ERR ", p, "=>", repr(e)[:300])
