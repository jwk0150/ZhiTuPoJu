# -*- coding: utf-8 -*-
"""端到端验证：模拟前端调用市级岗位分析接口（含筛选继承场景 + 兜底补充）"""
import asyncio
import asyncpg

try:
    from fastapi.testclient import TestClient
    from backend.main import app
    HAVE_HTTP = True
except Exception as e:
    print("[WARN] TestClient 不可用:", e)
    HAVE_HTTP = False


def http_verify():
    client = TestClient(app)
    # 1) 不带筛选：南昌市岗位分析
    r = client.get("/api/map/city/江西/南昌市")
    print("[HTTP 南昌 无筛选]", r.status_code)
    d = r.json().get("data") or {}
    print("   totalJobs =", d.get("totalJobs"), "| topJobs =", len(d.get("topJobs") or []),
          "| avgSalary =", d.get("avgSalary"), "| skills =", len(d.get("skills") or []))

    # 2) 带旧筛选（模拟省级筛选继承）：也应返回数据（后端兜底）
    r2 = client.get("/api/map/city/江西/南昌市?industry=软件开发&education=本科&experience=3-5年")
    print("[HTTP 南昌 带筛选继承]", r2.status_code)
    d2 = r2.json().get("data") or {}
    print("   totalJobs =", d2.get("totalJobs"), "| topJobs =", len(d2.get("topJobs") or []))

    # 3) 全量岗位接口（前端兜底路径）
    r3 = client.get("/api/map/city-jobs/南昌")
    print("[HTTP city-jobs 南昌]", r3.status_code)
    d3 = r3.json().get("data") or {}
    print("   totalJobs =", d3.get("totalJobs"), "| jobs =", len(d3.get("jobs") or []),
          "| isSupplemented =", d3.get("isSupplemented"))

    # 4) 深圳（广东省）
    r4 = client.get("/api/map/city/广东/深圳市")
    print("[HTTP 深圳 无筛选]", r4.status_code)
    d4 = r4.json().get("data") or {}
    print("   totalJobs =", d4.get("totalJobs"), "| topJobs =", len(d4.get("topJobs") or []))


async def main():
    if HAVE_HTTP:
        http_verify()
    # 函数级补充：虚构城市写库补充再清理
    conn = await asyncpg.connect(host="127.0.0.1", port=5432, user="postgres",
                                 password="123456", database="postgres")
    from backend.services import _ensure_city_min_jobs
    fake = "验证测试市"
    added = await _ensure_city_min_jobs(conn, fake, 20)
    cnt = await conn.fetchval(
        "SELECT count(*) FROM the_total_table WHERE split_part(city,'·',1)=$1", fake)
    print(f"[函数级 虚构城市] 新增={added} 现存量={cnt}")
    await conn.execute("DELETE FROM the_total_table WHERE split_part(city,'·',1)=$1", fake)
    print("[清理] 虚构城市数据已删除")
    await conn.close()


asyncio.run(main())
