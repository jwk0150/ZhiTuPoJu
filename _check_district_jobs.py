# -*- coding: utf-8 -*-
"""检查直辖市各区在数据库中的岗位数据量"""
import asyncio
import sys
sys.path.insert(0, r'd:\Learning_test\newtest\ZhiTuPoJu\backend')
from db_async import get_pool

async def main():
    pool = await get_pool()
    targets = ['北京·朝阳区', '上海·浦东新区', '天津·和平区', '重庆·渝中区', '香港', '澳门']
    for t in targets:
        cnt = await pool.fetchval("SELECT count(*) FROM the_total_table WHERE city = $1", t)
        titles = await pool.fetchval("SELECT count(DISTINCT job_title) FROM the_total_table WHERE city = $1", t)
        print(f"[{t}] records={cnt} distinct_jobs={titles}")
    # 北京整体
    for t in ['北京', '上海', '天津', '重庆']:
        cnt = await pool.fetchval("SELECT count(*) FROM the_total_table WHERE split_part(city,'·',1)=$1", t)
        print(f"[{t}全境] records={cnt}")

asyncio.run(main())
