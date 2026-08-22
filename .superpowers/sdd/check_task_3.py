# Task 3 source check — home journey + teal particles
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend"

FILES = {
    "html": FRONT / "pages" / "home.html",
    "home_js": FRONT / "js" / "pages" / "home.js",
}

errors = []

for key, path in FILES.items():
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

html = FILES["html"].read_text(encoding="utf-8") if FILES["html"].is_file() else ""
home_js = FILES["home_js"].read_text(encoding="utf-8") if FILES["home_js"].is_file() else ""

# particles may live in home.js or particles-teal.js
particles_path = FRONT / "js" / "pages" / "particles-teal.js"
particles = particles_path.read_text(encoding="utf-8") if particles_path.is_file() else ""
js_all = home_js + "\n" + particles

css_comp = (FRONT / "css" / "components.css").read_text(encoding="utf-8")
css_home = (FRONT / "css" / "home.css").read_text(encoding="utf-8") if (FRONT / "css" / "home.css").is_file() else ""
css_all = css_comp + "\n" + css_home + "\n" + html

checks = [
    ("html lang", 'lang="zh-CN"' in html),
    ("title", "执图破局 · 演示路径" in html),
    ("tokens css", "../css/tokens.css" in html),
    ("shell css", "../css/shell.css" in html),
    ("components css", "../css/components.css" in html),
    ("data-page home", 'data-page="home"' in html),
    ("app-shell", 'id="app-shell"' in html),
    ("page-main", 'id="page-main"' in html),
    ("api.js", "../js/api.js" in html),
    ("shell.js", "../js/shell.js" in html),
    ("home.js", "../js/pages/home.js" in html),
    ("step 数据与图谱底座", "数据与图谱底座" in html),
    ("step 看地图", "看地图" in html),
    ("step 看演化与发现", "看演化与发现" in html),
    ("step 做人岗匹配", "做人岗匹配" in html),
    ("copy 多源异构", "多源异构数据驱动岗位能力图谱" in html),
    ("link 采集", "采集" in html),
    ("link 质量", "质量" in html),
    ("four journey-step", html.count("journey-step") >= 4),
    ("is-primary CTA", "is-primary" in html),
    ("home-stage", "home-stage" in html),
    ("home-particles", "home-particles" in html),
    ("Shell.mount", "Shell.mount" in home_js),
    ("pageId home", "pageId" in home_js and "home" in home_js),
    ("title 演示路径", "演示路径" in home_js),
    ("subtitle path", "数据 → 图谱 → 匹配" in home_js),
    ("PAGE_HREF used", "PAGE_HREF" in home_js),
    ("no vue", "Vue" not in html and "vue" not in html.lower() and "react" not in html.lower()),
    ("particle count range", ("120" in js_all or "150" in js_all or "180" in js_all or "200" in js_all or "220" in js_all or "250" in js_all)),
    ("reduced-motion", "prefers-reduced-motion" in js_all or "prefers-reduced-motion" in css_all),
    ("pointer-events none", "pointer-events" in css_all and "none" in css_all),
    ("teal #2DD4BF", "#2DD4BF" in js_all or "#2dd4bf" in js_all.lower()),
    ("teal #0D9488", "#0D9488" in js_all or "#0d9488" in js_all.lower()),
    ("canvas", "<canvas" in html.lower() or "canvas" in js_all.lower()),
]

for name, ok in checks:
    if not ok:
        errors.append(f"FAIL {name}")

if errors:
    print("RED")
    for e in errors:
        print(" -", e)
    sys.exit(1)

print("PASS")
print("home.html + home.js: four journey steps, Shell.mount, PAGE_HREF, teal particles, reduced-motion")
