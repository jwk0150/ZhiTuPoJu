# -*- coding: utf-8 -*-
"""全量执行：按城市规模扩充各市岗位数据（多样化 + 数量充足 + 写入数据库，幂等）

注意：城市名从 CITY_TO_PROVINCE 读取（UTF-8 源码），避免 Windows 命令行中文参数编码问题。

用法：
    python _expand_city_jobs.py                    # 全部城市
    python _expand_city_jobs.py --province 江西    # 只处理一个省
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncpg
from backend.mappings import CITY_TO_PROVINCE
from backend.seed_city_jobs import ensure_city_min_jobs, _norm_city_for_query


async def cleanup_invalid_seed(conn):
    """清理 ai_seed 中城市名不在 CITY_TO_PROVINCE 的行（防止命令行乱码等异常数据）"""
    rows = await conn.fetch(
        "SELECT DISTINCT split_part(city,'·',1) AS c FROM the_total_table WHERE source_name='ai_seed'"
    )
    valid = {_norm_city_for_query(c) for c in CITY_TO_PROVINCE}
    bad = [r["c"] for r in rows if r["c"] and _norm_city_for_query(r["c"]) not in valid]
    if not bad:
        return 0
    deleted = 0
    for c in bad:
        r = await conn.execute(
            "DELETE FROM the_total_table WHERE source_name='ai_seed' AND split_part(city,'·',1)=$1",
            c,
        )
        try:
            deleted += int(r.split()[-1])
        except Exception:
            pass
    return deleted


async def expand_one(conn, city):
    city_short = _norm_city_for_query(city)
    added = await ensure_city_min_jobs(conn, city_short)
    # 读取扩充后规模
    rows = await conn.fetch(
        """SELECT count(*)::int AS recs, count(DISTINCT job_title)::int AS types
           FROM the_total_table
           WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1 || '市')""",
        city_short,
    )
    return city_short, added, rows[0]["recs"], rows[0]["types"]


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--province", default=None, help="只处理指定省份")
    args = parser.parse_args()

    conn = await asyncpg.connect(
        host="127.0.0.1", port=5432, user="postgres",
        password="123456", database="postgres",
    )
    try:
        cleaned = await cleanup_invalid_seed(conn)
        if cleaned:
            print(f"[清理] 删除 {cleaned} 条城市名无效的 ai_seed 记录")

        if args.province:
            targets = [c for c, p in CITY_TO_PROVINCE.items() if p == args.province]
            print(f"[省份] {args.province}（{len(targets)} 个城市）")
        else:
            targets = list(CITY_TO_PROVINCE.keys())
        print(f"{'城市':<12}{'新增':>5}{'扩充后记录':>9}{'类型':>6}")
        print("-" * 40)
        total_added = 0
        expanded = 0
        for city in targets:
            name, added, recs, types_ = await expand_one(conn, city)
            total_added += added
            if added > 0:
                expanded += 1
            print(f"{name:<14}{added:>5}{recs:>9}{types_:>6}")
        print("-" * 40)
        print(f"处理城市 {len(targets)} 个，其中扩充 {expanded} 个，共新增 {total_added} 条记录")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
