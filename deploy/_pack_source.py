# -*- coding: utf-8 -*-
"""打包执图破局源码到桌面（含 README，排除密钥与本地垃圾）。"""
from __future__ import annotations

import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(r"C:\Users\Ibiza\Desktop\project\挑战杯")
DESKTOP = Path(r"C:\Users\Ibiza\Desktop")
OUT = DESKTOP / f"执图破局_源码_{date.today().strftime('%Y%m%d')}.zip"
ARC_ROOT = "执图破局"

SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".workbuddy",
    ".playwright-cli",
    ".claude",
    ".codebuddy",
    ".cursor",
    ".superpowers",
    ".idea",
    ".vscode",
    "chrome_debug_profile",
    "exports",
    "_qa",
    "devtools",
    "shots",
    "temp-echarts-src",
    "pytest-cache-files-fc9q6838",
}

SKIP_FILE_NAMES = {
    ".env",
    ".DS_Store",
    "Thumbs.db",
}

SKIP_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".log",
    ".err",
    ".tmp",
}


def should_skip(path: Path, rel: Path) -> bool:
    parts = set(rel.parts)
    if parts & SKIP_DIR_NAMES:
        return True
    if path.name in SKIP_FILE_NAMES:
        return True
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    # backend/data 含本地账号，不打进包（README 已说明种子账号）
    if len(rel.parts) >= 2 and rel.parts[0] == "backend" and rel.parts[1] == "data":
        return True
    if path.name.startswith("temp-") and path.suffix == ".cjs":
        return True
    return False


def main() -> None:
    if not (ROOT / "README.md").exists():
        raise SystemExit("README.md missing")

    if OUT.exists():
        OUT.unlink()

    count = 0
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(ROOT)
            if should_skip(path, rel):
                continue
            arcname = f"{ARC_ROOT}/{rel.as_posix()}"
            zf.write(path, arcname)
            count += 1

    mb = OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {OUT}")
    print(f"files={count} size_mb={mb:.1f}")


if __name__ == "__main__":
    main()
