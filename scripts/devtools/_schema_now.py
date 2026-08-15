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
    r = await c.fetch(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='the_total_table' ORDER BY ordinal_position"
    )
    with open("_schema_now_out.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(f"{x[0]}:{x[1]}" for x in r) + "\n")
        f.write("\n--- counts ---\n")
        n = await c.fetchval("SELECT count(*) FROM the_total_table")
        f.write(f"total rows: {n}\n")
        ai = await c.fetchval("SELECT count(*) FROM the_total_table WHERE source_name='ai_seed'")
        f.write(f"ai_seed rows: {ai}\n")
    await c.close()
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
