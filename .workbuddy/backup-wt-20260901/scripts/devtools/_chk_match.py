# -*- coding: utf-8 -*-
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

load_dotenv(Path(__file__).resolve().parent / ".env")


async def main():
    c = await asyncpg.connect(
        host=os.getenv("PG_HOST", "127.0.0.1"),
        port=int(os.getenv("PG_PORT", "5432")),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASSWORD", "123456"),
        database=os.getenv("PG_DB", "postgres"),
    )
    out = []
    for city in ["南昌", "九江", "赣州"]:
        n1 = await c.fetchval("SELECT count(*) FROM the_total_table WHERE split_part(city,'·',1)=$1", city)
        n2 = await c.fetchval(
            "SELECT count(*) FROM the_total_table WHERE (split_part(city,'·',1)=$1 OR split_part(city,'·',1)=$1||'市')",
            city,
        )
        out.append(f"{city}: split_part={n1}, api条件={n2}")
    txt = "\n".join(out)
    print(txt)
    with open("_chk_match_out.txt", "w", encoding="utf-8") as f:
        f.write(txt + "\n")
    await c.close()


if __name__ == "__main__":
    asyncio.run(main())
