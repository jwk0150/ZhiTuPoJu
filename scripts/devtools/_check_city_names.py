# -*- coding: utf-8 -*-
"""Check actual city name formats in the DB."""
import psycopg

dsn = "host=127.0.0.1 port=5433 user=postgres password=20051122 dbname=zhitu_crawl_db"
conn = psycopg.connect(dsn, connect_timeout=3)
cur = conn.execute(
    "SELECT city, COUNT(*) FROM the_total_table "
    "WHERE city ILIKE '%%南昌%%' OR city ILIKE '%%广州%%' OR city ILIKE '%%九江%%' "
    "GROUP BY city ORDER BY city LIMIT 50"
)
for r in cur.fetchall():
    print(f"{r[0]!r}: {r[1]}")
conn.close()
print("---done---")
