# -*- coding: utf-8 -*-
import sys
from pathlib import Path

lines = []
lines.append(f"python: {sys.version}")
try:
    import asyncpg
    lines.append(f"asyncpg: {asyncpg.__version__}")
except Exception as e:
    lines.append(f"asyncpg ERR: {e}")
try:
    from backend.mappings import CITY_TO_PROVINCE
    lines.append(f"mappings ok: {len(CITY_TO_PROVINCE)} cities")
except Exception as e:
    lines.append(f"mappings ERR: {e}")
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
    import os
    lines.append(f"PG env: host={os.getenv('PG_HOST')} port={os.getenv('PG_PORT')} db={os.getenv('PG_DB')} user={os.getenv('PG_USER')}")
except Exception as e:
    lines.append(f"dotenv ERR: {e}")

out = Path(__file__).resolve().parent / "_env_out.txt"
out.write_text("\n".join(lines), encoding="utf-8")
print("written", len(lines))
