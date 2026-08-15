"""临时脚本：查看江西各城市在数据库中的真实 city 格式"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "127.0.0.1", "port": 5432,
    "database": "postgres", "user": "postgres", "password": "123456",
}


async def main():
    conn = await asyncpg.connect(**DB_CONFIG, timeout=8)
    rows = await conn.fetch("""
        SELECT city, count(*)::int AS cnt
        FROM the_total_table
        WHERE city LIKE '南昌%' OR city LIKE '九江%' OR city LIKE '赣州%'
           OR city LIKE '上饶%' OR city LIKE '吉安%' OR city LIKE '抚州%'
           OR city LIKE '宜春%' OR city LIKE '景德镇%' OR city LIKE '萍乡%'
           OR city LIKE '新余%' OR city LIKE '鹰潭%'
        GROUP BY city ORDER BY city
    """)
    print("== 江西 city 格式 ==")
    for r in rows:
        print(f"  '{r['city']}': {r['cnt']}")

    allc = await conn.fetch("""
        SELECT city, count(*)::int AS cnt FROM the_total_table
        GROUP BY city ORDER BY cnt DESC LIMIT 60
    """)
    print("== 全国 top60 city ==")
    for r in allc:
        print(f"  '{r['city']}': {r['cnt']}")

    await conn.close()


asyncio.run(main())
