# -*- coding: utf-8 -*-
"""临时检查：相关表是否存在及其列"""
import asyncio
import asyncpg


async def main():
    conn = await asyncpg.connect(host="127.0.0.1", port=5432,
                                 user="postgres", password="123456",
                                 database="postgres")
    tables = await conn.fetch(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_name IN ('the_total_table','job_posting_details','job_postings')"
    )
    names = [x["table_name"] for x in tables]
    print("tables:", names)
    if "job_posting_details" in names:
        cols = await conn.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='job_posting_details' ORDER BY ordinal_position"
        )
        print("job_posting_details cols:", [x["column_name"] for x in cols])
    await conn.close()


asyncio.run(main())
