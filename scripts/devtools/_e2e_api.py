# -*- coding: utf-8 -*-
"""端到端验证：/map/city-jobs API 南昌/九江/赣州差异化"""
import json
import urllib.request
import urllib.parse


def fetch(path):
    url = "http://127.0.0.1:5000" + urllib.parse.quote(path, safe="/")
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


def main():
    out = []
    for city in ["南昌", "九江", "赣州"]:
        q = urllib.parse.quote(city)
        d = fetch(f"/api/map/city-jobs/{q}")
        if "error" in d:
            out.append(f"[{city}] ERROR: {d['error']}")
            continue
        d = d.get("data") or {}
        jobs = d.get("jobs", [])
        names = [j["name"] for j in jobs]
        real = sum(1 for j in jobs if j.get("isReal"))
        gen = len(jobs) - real
        out.append(f"[{city}] totalJobs={d.get('totalJobs')} 展示{len(jobs)}条(真实{real}/生成{gen})")
        out.append(f"   TOP10: {names[:10]}")
        out.append(f"   行业: {d.get('industries')}")
    txt = "\n".join(out)
    print(txt)
    with open("_e2e_api_out.txt", "w", encoding="utf-8") as f:
        f.write(txt + "\n")


if __name__ == "__main__":
    main()
