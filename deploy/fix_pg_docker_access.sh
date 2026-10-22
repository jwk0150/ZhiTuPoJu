#!/usr/bin/env bash
set -euo pipefail

CONF=/etc/postgresql/14/main/postgresql.conf
HBA=/etc/postgresql/14/main/pg_hba.conf

python3 - <<'PY'
from pathlib import Path
import re

conf = Path("/etc/postgresql/14/main/postgresql.conf")
text = conf.read_text(encoding="utf-8")
new, n = re.subn(
    r"^#?\s*listen_addresses\s*=\s*.*$",
    "listen_addresses = 'localhost,172.17.0.1'",
    text,
    count=1,
    flags=re.M,
)
if n == 0:
    new = text + "\nlisten_addresses = 'localhost,172.17.0.1'\n"
conf.write_text(new, encoding="utf-8")
print("postgresql.conf listen_addresses updated, replacements=", n)

hba = Path("/etc/postgresql/14/main/pg_hba.conf")
h = hba.read_text(encoding="utf-8")
line = "host    all             all             172.16.0.0/12            scram-sha-256"
if "172.16.0.0/12" not in h:
    hba.write_text(h.rstrip() + "\n" + line + "\n", encoding="utf-8")
    print("pg_hba.conf docker subnet added")
else:
    print("pg_hba.conf already has docker subnet")
PY

systemctl restart postgresql
sleep 2
sudo -u postgres psql -c "SHOW listen_addresses;"

docker exec zhitu-backend python - <<'PY'
import asyncio, asyncpg, os

async def main():
    conn = await asyncpg.connect(
        host=os.environ["PG_HOST"],
        port=int(os.environ["PG_PORT"]),
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASSWORD"],
        database=os.environ["PG_DB"],
    )
    print("db_ok", await conn.fetchval("select 1"))
    await conn.close()

asyncio.run(main())
PY

# restart backend to clear bad pool
docker restart zhitu-backend
sleep 4
curl -fsS -o /tmp/map.json -w "map %{http_code} %{size_download}\n" http://127.0.0.1/api/map/provinces
head -c 200 /tmp/map.json; echo
curl -fsS http://127.0.0.1/api/health; echo
