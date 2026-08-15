# -*- coding: utf-8 -*-
"""最小复现：带筛选的城市详情请求完整堆栈"""
import traceback

try:
    from fastapi.testclient import TestClient
    from backend.main import app
except Exception as e:
    print("import fail:", e)
    raise

client = TestClient(app)

print("=== 请求1: 南昌 无筛选 ===")
try:
    r = client.get("/api/map/city/江西/南昌市")
    d = r.json().get("data") or {}
    print("status =", r.status_code, "| totalJobs =", d.get("totalJobs"),
          "| topJobs =", len(d.get("topJobs") or []))
except Exception:
    traceback.print_exc()

print("=== 请求2: 南昌 带筛选继承 ===")
try:
    r2 = client.get("/api/map/city/江西/南昌市?industry=软件开发&education=本科&experience=3-5年")
    d2 = r2.json().get("data") or {}
    print("status =", r2.status_code, "| totalJobs =", d2.get("totalJobs"),
          "| topJobs =", len(d2.get("topJobs") or []))
except Exception:
    traceback.print_exc()

print("=== 请求3: city-jobs 南昌 ===")
try:
    r3 = client.get("/api/map/city-jobs/南昌")
    d3 = r3.json().get("data") or {}
    print("status =", r3.status_code, "| totalJobs =", d3.get("totalJobs"),
          "| jobs =", len(d3.get("jobs") or []))
except Exception:
    traceback.print_exc()

print("=== 请求4: 深圳 无筛选 ===")
try:
    r4 = client.get("/api/map/city/广东/深圳市")
    d4 = r4.json().get("data") or {}
    print("status =", r4.status_code, "| totalJobs =", d4.get("totalJobs"),
          "| topJobs =", len(d4.get("topJobs") or []))
except Exception:
    traceback.print_exc()
