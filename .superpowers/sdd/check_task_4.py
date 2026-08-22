from pathlib import Path

root = Path(__file__).resolve().parents[2] / "frontend"
login = (root / "login.html").read_text(encoding="utf-8")
index = (root / "index.html").read_text(encoding="utf-8")
portal = (root / "portal.html").read_text(encoding="utf-8")
ok = True


def chk(name, cond, detail):
    global ok
    print(("PASS" if cond else "FAIL"), name, "-", detail)
    if not cond:
        ok = False


chk("login no portal.html", "portal.html" not in login, "count=%d" % login.count("portal.html"))
chk("login home redirects", login.count("pages/home.html") >= 2, "count=%d" % login.count("pages/home.html"))
chk(
    "index short redirect",
    len(index.splitlines()) <= 20 and "login.html" in index and "location.replace" in index,
    "lines=%d" % len(index.splitlines()),
)
chk("index not full app", "echarts" not in index.lower() and "switchView" not in index, "ok")
chk(
    "portal banner",
    "你正在使用旧版单页门户" in portal and 'href="pages/home.html"' in portal,
    "banner+link",
)
chk("portal bootHashView", "function bootHashView" in portal, "present")
i_def = portal.find("window.switchView = function")
i_boot = portal.find("function bootHashView")
chk("boot after switchView", i_def != -1 and i_boot > i_def, "def=%d boot=%d" % (i_def, i_boot))
chk("hash strips #view-", "replace(/^#view-/, '')" in portal, "parser")
print("OVERALL", "PASS" if ok else "FAIL")
raise SystemExit(0 if ok else 1)
