#!/usr/bin/env python3
"""Phase 0 acceptance checklist (Task 6)."""
from __future__ import annotations

import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
FRONTEND = "http://127.0.0.1:8080"
BACKEND = "http://127.0.0.1:5000"


def fetch(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def main() -> int:
    home_status, home = fetch(f"{FRONTEND}/pages/home.html")
    login_status, login = fetch(f"{FRONTEND}/login.html")
    portal_status, portal = fetch(f"{FRONTEND}/portal.html")
    health_status, _ = fetch(f"{BACKEND}/api/health")
    shell = (ROOT / "frontend/js/shell.js").read_text(encoding="utf-8")

    root_underscore = list(ROOT.glob("_*"))
    root_check = list(ROOT.glob("_check_*.py"))

    checks: list[tuple[str, bool, str]] = [
        ("Servers up (home/login/portal/health HTTP 200)", all(s == 200 for s in (home_status, login_status, portal_status, health_status)), f"home={home_status} login={login_status} portal={portal_status} health={health_status}"),
        ("/pages/home.html shell marker (#app-shell + shell.js)", 'id="app-shell"' in home and "shell.js" in home, "app-shell + shell.js"),
        ("/pages/home.html 4 journey steps", len(re.findall(r'<section class="journey-step', home)) == 4, f"count={len(re.findall(r'<section class=\"journey-step', home))}"),
        ("particles-teal.js on home", "particles-teal.js" in home, "script tag present"),
        ("Sidebar 更多 toggles more nav", "data-more-toggle" in shell and "更多" in shell, "toggle + label"),
        ("More bridges (collection/analysis/quality/settings)", all(x in shell for x in ("view-collection", "view-analysis", "view-quality", "view-settings")), "PAGE_HREF bridges"),
        ("Demo path + next link in shell.js", "demo-path" in shell and "demo-path-next" in shell, "renderDemoPath"),
        ("Login redirect pages/home.html", "pages/home.html" in login, "redirect target"),
        ("Portal legacy banner visible", "legacy-portal-banner" in portal and "pages/home.html" in portal, "banner markup"),
        ("#view-match section in portal", 'id="view-match"' in portal, "match view section"),
        ("Root _check_*.py gone", len(root_check) == 0, f"root count={len(root_check)}"),
        ("Root _* count = 0", len(root_underscore) == 0, f"root count={len(root_underscore)}"),
    ]

    print("Phase 0 acceptance checklist")
    print("-" * 60)
    all_pass = True
    for name, ok, detail in checks:
        mark = "PASS" if ok else "FAIL"
        print(f"{mark} | {name} | {detail}")
        all_pass = all_pass and ok
    print("-" * 60)
    print("OVERALL", "PASS" if all_pass else "FAIL")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
