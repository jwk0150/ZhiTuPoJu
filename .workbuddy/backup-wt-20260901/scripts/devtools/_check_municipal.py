# -*- coding: utf-8 -*-
"""检查直辖市/港澳的 city 与 district 字段数据"""
import asyncio
import sys
sys.path.insert(0, r'd:\Learning_test\newtest\ZhiTuPoJu\backend')
from db_async import get_pool

async def main():
    pool = await get_pool()
    targets = ['北京', '上海', '天津', '重庆', '香港', '澳门']
    for t in targets:
        rows = await pool.fetch("""
            SELECT DISTINCT city FROM the_total_table
            WHERE city ILIKE $1 ORDER BY city LIMIT 60
        """, f'%{t}%')
        cities = [r['city'] for r in rows]
        print(f"[{t}] city distinct ({len(cities)}):", cities[:40])

    for t in ['北京', '上海', '天津', '重庆']:
        rows = await pool.fetch("""
            SELECT DISTINCT district FROM the_total_table
            WHERE city ILIKE $1 AND district IS NOT NULL AND district != ''
            ORDER BY district LIMIT 40
        """, f'%{t}%')
        districts = [r['district'] for r in rows]
        print(f"[{t}] district distinct ({len(districts)}):", districts[:30])

asyncio.run(main())
