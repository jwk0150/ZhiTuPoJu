# -*- coding: utf-8 -*-
"""Create the_total_table view over zhilian_job_postings for map API compatibility."""
import asyncio
import asyncpg

VIEW_SQL = """
CREATE OR REPLACE VIEW public.the_total_table AS
SELECT
  id,
  source_name,
  source_id,
  source_id_hash,
  job_title,
  company_name,
  city,
  district,
  salary_min,
  salary_max,
  salary_unit,
  experience,
  education,
  job_type,
  publish_time,
  crawl_time,
  status,
  fingerprint,
  completeness,
  NULL::text AS industry_tags,
  NULL::text AS skills,
  NULL::text AS job_description,
  NULL::text AS qualification,
  NULL::text AS work_experience,
  NULL::smallint AS city_seed,
  NULL::integer AS sort_weight
FROM public.zhilian_job_postings;
"""


async def main():
    c = await asyncpg.connect(
        host="127.0.0.1",
        port=3309,
        user="postgres",
        password="123456",
        database="zhilian_crawl_db",
        timeout=5,
    )
    await c.execute(VIEW_SQL)
    n = await c.fetchval("SELECT count(*) FROM the_total_table")
    cities = await c.fetch(
        "SELECT city, count(*)::int AS c FROM the_total_table "
        "WHERE city IS NOT NULL GROUP BY city ORDER BY c DESC LIMIT 8"
    )
    print("view ok, rows=", n)
    for r in cities:
        print(f"  {r['city']}: {r['c']}")
    await c.close()


if __name__ == "__main__":
    asyncio.run(main())
