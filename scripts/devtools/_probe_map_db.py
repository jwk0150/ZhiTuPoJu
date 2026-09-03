# -*- coding: utf-8 -*-
"""Probe 5432 zhitu_crawl_db for map_data_table."""
import asyncio
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parents[2]
envp = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    envp[k.strip()] = v.strip()

pwd = envp.get("PG_PASSWORD", "")
candidates = [
    {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": pwd, "database": "zhitu_crawl_db"},
    {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "123456", "database": "zhitu_crawl_db"},
    {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "Shangshanruoshui@", "database": "zhitu_crawl_db"},
    {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "postgres", "database": "zhitu_crawl_db"},
]


async def try_one(kw):
    try:
        conn = await asyncpg.connect(**kw, timeout=8)
        dbs = [r["datname"] for r in await conn.fetch(
            "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1"
        )]
        tables = [r["table_name"] for r in await conn.fetch(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public'
              AND (table_name ILIKE '%map%' OR table_name ILIKE '%total%' OR table_name ILIKE '%job%')
            ORDER BY 1
            """
        )]
        out = {
            "ok": True,
            "port": kw["port"],
            "pwd_hint": (kw["password"][:2] + "***") if kw["password"] else "(empty)",
            "dbs": dbs,
            "tables": tables,
        }
        if "map_data_table" in tables:
            cols = await conn.fetch(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name='map_data_table'
                ORDER BY ordinal_position
                """
            )
            out["map_cols"] = [(c["column_name"], c["data_type"]) for c in cols]
            out["map_cnt"] = await conn.fetchval("SELECT count(*) FROM map_data_table")
            sample = await conn.fetch("SELECT * FROM map_data_table LIMIT 1")
            if sample:
                row = dict(sample[0])
                # truncate long text
                for k, v in list(row.items()):
                    if isinstance(v, str) and len(v) > 80:
                        row[k] = v[:80] + "…"
                out["sample"] = row
        for name in ("the_total_table", "map_data_table"):
            if name in tables:
                out[f"{name}_cnt"] = await conn.fetchval(f'SELECT count(*) FROM "{name}"')
                cols = await conn.fetch(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name=$1 ORDER BY ordinal_position
                    """,
                    name,
                )
                out[f"{name}_cols"] = [c["column_name"] for c in cols]
        await conn.close()
        return out
    except Exception as e:
        return {
            "ok": False,
            "port": kw["port"],
            "pwd_hint": (kw["password"][:2] + "***") if kw["password"] else "(empty)",
            "err": f"{type(e).__name__}: {str(e)[:160]}",
        }


async def main():
    seen = set()
    for kw in candidates:
        key = (kw["port"], kw["password"], kw["database"])
        if key in seen:
            continue
        seen.add(key)
        r = await try_one(kw)
        print(r)
        if r.get("ok") and r.get("map_cnt") is not None:
            break


if __name__ == "__main__":
    asyncio.run(main())
