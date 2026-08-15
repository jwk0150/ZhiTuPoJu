# -*- coding: utf-8 -*-
"""真实服务器验证：uvicorn 后台启动 + HTTP 请求（模拟前端调用）"""
import subprocess
import sys
import time
import json
import urllib.request
import urllib.parse

ROOT = r"d:/Learning_test/newtest/ZhiTuPoJu"
PORT = 8090
BASE = f"http://127.0.0.1:{PORT}/api/map"

proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(PORT), "--log-level", "warning"],
    cwd=ROOT,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)


def get(url: str):
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))


def q(path: str) -> str:
    return BASE + path


try:
    # 等待服务就绪
    ready = False
    for _ in range(80):
        try:
            get(q("/city/" + urllib.parse.quote("北京") + "/" + urllib.parse.quote("北京市")))
            ready = True
            break
        except Exception:
            time.sleep(0.5)
    if not ready:
        print("[FAIL] 服务未就绪")
        sys.exit(1)

    d1 = get(q("/city/" + urllib.parse.quote("江西") + "/" + urllib.parse.quote("南昌市")))["data"]
    print("请求1 南昌 无筛选:", "totalJobs =", d1.get("totalJobs"), "| topJobs =", len(d1.get("topJobs") or []),
          "| avgSalary =", d1.get("avgSalary"), "| skills =", len(d1.get("skills") or []))

    d2 = get(q("/city/" + urllib.parse.quote("江西") + "/" + urllib.parse.quote("南昌市")
               + "?industry=" + urllib.parse.quote("软件开发")
               + "&education=" + urllib.parse.quote("本科")
               + "&experience=" + urllib.parse.quote("3-5年")))["data"]
    print("请求2 南昌 带筛选继承:", "totalJobs =", d2.get("totalJobs"), "| topJobs =", len(d2.get("topJobs") or []))

    d3 = get(q("/city-jobs/" + urllib.parse.quote("南昌")))["data"]
    print("请求3 city-jobs 南昌:", "totalJobs =", d3.get("totalJobs"), "| jobs =", len(d3.get("jobs") or []),
          "| isSupplemented =", d3.get("isSupplemented"))

    d4 = get(q("/city/" + urllib.parse.quote("广东") + "/" + urllib.parse.quote("深圳市")))["data"]
    print("请求4 深圳 无筛选:", "totalJobs =", d4.get("totalJobs"), "| topJobs =", len(d4.get("topJobs") or []))

    d5 = get(q("/city-jobs/" + urllib.parse.quote("验证测试市")))["data"]
    print("请求5 city-jobs 虚构城市(触发写库补充):", "totalJobs =", d5.get("totalJobs"),
          "| jobs =", len(d5.get("jobs") or []), "| isSupplemented =", d5.get("isSupplemented"))

    print("[OK] 全部请求完成")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
