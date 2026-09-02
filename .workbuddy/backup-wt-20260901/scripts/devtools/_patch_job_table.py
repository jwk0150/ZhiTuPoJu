# -*- coding: utf-8 -*-
"""Point talent-map SQL in services.py / talent_map.py at PG_JOB_TABLE."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def patch_services():
    path = ROOT / "backend" / "services.py"
    text = path.read_text(encoding="utf-8")
    if "JOB_TABLE =" not in text:
        anchor = "from backend.mappings import ("
        insert = (
            "from backend.config import config\n\n"
            "_JOB_TABLE_RAW = (config.PG_JOB_TABLE or \"map_data_table\").strip()\n"
            "if not _JOB_TABLE_RAW.replace(\"_\", \"\").isalnum():\n"
            "    raise RuntimeError(f\"Invalid PG_JOB_TABLE: {_JOB_TABLE_RAW!r}\")\n"
            "JOB_TABLE = _JOB_TABLE_RAW\n\n"
        )
        if anchor not in text:
            raise SystemExit("services.py: missing mappings import anchor")
        text = text.replace(anchor, insert + anchor, 1)

    # Replace SQL identifier; keep Chinese comment mentioning old name if desired
    n = text.count("the_total_table")
    # Use concrete name from .env via config — but at patch time hardcode token JOB_TABLE in f-strings.
    # Easiest safe approach: substitute literal map_data_table (matches .env default).
    # Prefer dynamic: replace with {JOB_TABLE} and ensure enclosing strings are f-strings.

    lines = text.splitlines(keepends=True)
    out = []
    for line in lines:
        if "the_total_table" not in line:
            out.append(line)
            continue
        if line.lstrip().startswith("#") or "数据完全来自" in line:
            out.append(line.replace("the_total_table", "map_data_table / JOB_TABLE"))
            continue
        # Already f-string
        if 'f"' in line or "f'" in line or 'f"""' in line:
            out.append(line.replace("the_total_table", "{JOB_TABLE}"))
            continue
        # Triple-quoted SQL blocks often use """ without f
        if '"""' in line or "'''" in line:
            # convert opening """ to f"""
            fixed = line.replace("the_total_table", "{JOB_TABLE}")
            if 'f"""' not in fixed and '"""' in fixed:
                fixed = fixed.replace('"""', 'f"""', 1)
            if "f'''" not in fixed and "'''" in fixed:
                fixed = fixed.replace("'''", "f'''", 1)
            out.append(fixed)
            continue
        # Plain "..." or '...'
        fixed = line.replace("the_total_table", "{JOB_TABLE}")
        if 'f"' not in fixed and '"' in fixed:
            # prefix first quote group with f
            fixed = fixed.replace('"', 'f"', 1)
        elif "f'" not in fixed and "'" in fixed:
            fixed = fixed.replace("'", "f'", 1)
        out.append(fixed)
    new_text = "".join(out)
    path.write_text(new_text, encoding="utf-8")
    print(f"services.py: touched {n} the_total_table refs")


def patch_talent_map():
    path = ROOT / "backend" / "routers" / "talent_map.py"
    text = path.read_text(encoding="utf-8")
    if "JOB_TABLE" not in text:
        text = text.replace(
            "from backend.services import (",
            "from backend.services import (\n    JOB_TABLE,",
            1,
        )
    if "the_total_table" in text:
        text = text.replace(
            "FROM the_total_table",
            "FROM {JOB_TABLE}",
        )
        # make that SQL an f-string
        text = text.replace(
            'rows = await conn.fetch("""\n            SELECT job_title, count(*)::int AS cnt\n            FROM {JOB_TABLE}',
            'rows = await conn.fetch(f"""\n            SELECT job_title, count(*)::int AS cnt\n            FROM {JOB_TABLE}',
            1,
        )
    path.write_text(text, encoding="utf-8")
    print("talent_map.py patched")


if __name__ == "__main__":
    patch_services()
    patch_talent_map()
