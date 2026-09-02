# -*- coding: utf-8 -*-
"""接口级验证：城市岗位分析数据质量（自带 uvicorn 服务器）

验证：
1. 南昌/九江/赣州 岗位分析返回：记录数 >= 20、类型多样
2. 同一城市两次调用排序一致（稳定排序）
3. 不同城市排序不同
4. 统计（热门/薪资/行业/学历/经验/技能）随新数据同步
"""
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

BASE = "http://localhost:5000/api"
PORT = 5000


def get(path):
    url = BASE + urllib.parse.quote(path, safe="/%")
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    # 1) 南昌两次调用（验证稳定排序）
    p1 = get("/map/city/江西/南昌市")
    time.sleep(0.3)
    p2 = get("/map/city/江西/南昌市")
    d1, d2 = p1["data"], p2["data"]
    t1 = [j["name"] for j in d1["topJobs"][:10]]
    t2 = [j["name"] for j in d2["topJobs"][:10]]
    print(f"[南昌] totalJobs={d1['totalJobs']} topJobs={len(d1['topJobs'])}")
    print(f"   TOP10: {t1}")
    print(f"   两次调用排序一致: {t1 == t2}")

    # 2) 九江/赣州
    jj = get("/map/city/江西/九江市")["data"]
    gz = get("/map/city/江西/赣州市")["data"]
    tj = [j["name"] for j in jj["topJobs"][:10]]
    tg = [j["name"] for j in gz["topJobs"][:10]]
    print(f"[九江] totalJobs={jj['totalJobs']} TOP10: {tj}")
    print(f"[赣州] totalJobs={gz['totalJobs']} TOP10: {tg}")
    print(f"   南昌≠九江≠赣州: {t1 != tj != tg != t1}")

    # 3) 统计字段（键名：avgSalary 顶层 / educationDist / experienceDist / skills）
    for name, d in [("南昌", d1), ("九江", jj), ("赣州", gz)]:
        print(f"[{name}] 统计: 平均薪资={d.get('avgSalary')}, "
              f"学历={len(d.get('educationDist') or [])}类, "
              f"经验={len(d.get('experienceDist') or [])}类, "
              f"技能={len(d.get('skills') or [])}项")

    # 4) 技能图谱数据（skills 随扩充后岗位）
    sk = set()
    for j in d1["topJobs"]:
        for s in (j.get("skills") or []):
            sk.add(s)
    print(f"[南昌] TOP岗位技能数={len(sk)} 示例={list(sk)[:6]}")

    # 5) 深圳（真实大数据城市）
    sz = get("/map/city/广东/深圳市")["data"]
    print(f"[深圳] totalJobs={sz['totalJobs']} topJobs={len(sz['topJobs'])}")


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(PORT), "--log-level", "warning"],
        cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        # 等待服务就绪
        for _ in range(40):
            try:
                get("/map/provinces")
                break
            except Exception:
                time.sleep(0.5)
        else:
            print("服务器启动失败")
            sys.exit(1)
        main()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
