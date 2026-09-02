# -*- coding: utf-8 -*-
"""API 层验收：8省×3城，验证岗位数/排序/技能/稳定性（前端实际看到的数据）"""
import json
import urllib.request
import urllib.parse

BASE = "http://127.0.0.1:5000/api/map"

CITIES = {
    "北京": ["北京"],
    "上海": ["上海"],
    "广东": ["广州", "深圳", "佛山"],
    "江西": ["南昌", "九江", "赣州"],
    "江苏": ["南京", "苏州", "无锡"],
    "四川": ["成都", "绵阳", "南充"],
    "山东": ["济南", "青岛", "烟台"],
    "湖北": ["武汉", "宜昌", "襄阳"],
}


def fetch(city):
    url = BASE + "/city-jobs/" + urllib.parse.quote(city)
    with urllib.request.urlopen(url, timeout=30) as r:
        body = json.loads(r.read().decode("utf-8"))
    d = body.get("data") or body
    jobs = d.get("jobs") or d.get("job_list") or d.get("list") or []
    return jobs, d.get("totalJobs") or d.get("total_jobs") or len(jobs)


def main():
    out = []
    for prov, cities in CITIES.items():
        for c in cities:
            jobs1, total1 = fetch(c)
            jobs2, total2 = fetch(c)  # 二次请求验证稳定
            titles1 = [j.get("name") or j.get("job_title") or j.get("title") for j in jobs1]
            titles2 = [j.get("name") or j.get("job_title") or j.get("title") for j in jobs2]
            skills1 = [j.get("skills") for j in jobs1[:3]]
            skills2 = [j.get("skills") for j in jobs2[:3]]
            stable = (total1 == total2 and titles1 == titles2 and skills1 == skills2)
            line = (
                f"{prov}|{c}|total={total1}|types={len(set(titles1))}|"
                f"top5={'/'.join(titles1[:5])}|stable={stable}"
            )
            out.append(line)
            print(line)
    with open("_api_acceptance.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(out))


if __name__ == "__main__":
    main()
