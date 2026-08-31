# -*- coding: utf-8 -*-
import asyncio
import asyncpg


async def main():
    c = await asyncpg.connect(
        host="127.0.0.1",
        port=3309,
        user="postgres",
        password="123456",
        database="zhilian_crawl_db",
        timeout=5,
    )
    cols = await c.fetch(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'zhilian_job_postings'
        ORDER BY ordinal_position
        """
    )
    print("zhilian_job_postings columns:")
    for r in cols:
        print(f"  {r['column_name']}: {r['data_type']}")
    sample = await c.fetch("SELECT * FROM zhilian_job_postings LIMIT 1")
    if sample:
        print("sample keys:", list(sample[0].keys()))
        row = dict(sample[0])
        for k in ("city", "job_title", "salary_min", "salary_max", "education", "experience", "industry_tags", "skills", "crawl_time"):
            print(f"  {k}={row.get(k)!r}")
    await c.close()


if __name__ == "__main__":
    asyncio.run(main())
