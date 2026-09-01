# -*- coding: utf-8 -*-
"""Extract remaining views into standalone pages (HTML + best-effort JS)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("frontend")
portal = (ROOT / "portal.html").read_text(encoding="utf-8", errors="replace")


def extract_section(text: str, view_id: str) -> str:
    m = re.search(rf'<section[^>]*id="{re.escape(view_id)}"[^>]*>', text)
    if not m:
        raise SystemExit(f"missing {view_id}")
    start = m.start()
    pos = m.end()
    depth = 1
    while pos < len(text) and depth:
        nxt_open = text.find("<section", pos)
        nxt_close = text.find("</section>", pos)
        if nxt_close < 0:
            break
        if nxt_open >= 0 and nxt_open < nxt_close:
            depth += 1
            pos = nxt_open + 8
        else:
            depth -= 1
            pos = nxt_close + len("</section>")
            if depth == 0:
                html = text[start:pos]
                return html.replace('class="view"', 'class="view active"', 1)
    raise SystemExit(f"unclosed {view_id}")


def extract_js_between(start_marker: str, end_marker: str) -> str:
    s = portal.find(start_marker)
    if s < 0:
        return f"/* missing JS start: {start_marker} */\n"
    e = portal.find(end_marker, s + 10)
    if e < 0:
        e = s + 50000
    return portal[s:e]


PAGES = [
    # page_id, view_id, title, subtitle, path, js_start, js_end, extra_cdn, boot_fn
    (
        "discovery",
        "view-discovery",
        "新岗位发现",
        "新兴岗位与能力信号",
        "pages/discovery.html",
        "// ============== Discovery",
        "// ============== Evolution",
        "",
        "window.initDiscovery && window.initDiscovery();",
    ),
    (
        "evolution",
        "view-evolution",
        "岗位能力演化",
        "技能兴衰与能力迁移",
        "pages/evolution.html",
        "// ============== Evolution",
        "// ============== Match View",
        '<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>',
        "window.initEvolution && window.initEvolution();",
    ),
    (
        "qa",
        "view-qa",
        "智能问答",
        "图谱驱动的岗位能力问答",
        "pages/qa.html",
        "// ============== QA View",
        "// ============== Collection",
        "",
        "window.initQA && window.initQA();",
    ),
]


def write_page(page_id, view_id, title, subtitle, relpath, js_start, js_end, cdn, boot):
    html = extract_section(portal, view_id)
    # Also pull learningPath/newSkill into evolution page as hidden sections if evolution
    extra = ""
    if page_id == "evolution":
        try:
            lp = extract_section(portal, "view-learningPath")
            ns = extract_section(portal, "view-newSkill")
            extra = "\n" + lp + "\n" + ns
        except SystemExit:
            pass
    js = extract_js_between(js_start, js_end)
    # discovery marker might differ
    if js.startswith("/* missing") and page_id == "discovery":
        for alt in ["// Discovery", "window.renderDiscovery", "window.initDiscovery"]:
            idx = portal.find(alt)
            print("try", alt, idx)
        # fallback: from renderDiscoveryList
        s = portal.find("window.renderDiscovery")
        if s < 0:
            s = portal.find("function renderDiscovery")
        e = portal.find("// ============== Evolution", s) if s > 0 else -1
        if s > 0 and e > s:
            js = portal[s:e]
    js_path = ROOT / "js" / "pages" / f"{page_id}.js"
    js_path.write_text(js + f"\n/* extracted for {page_id} */\n", encoding="utf-8")
    page = f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>执图破局 · {title}</title>
  <link rel=\"stylesheet\" href=\"../css/tokens.css\" />
  <link rel=\"stylesheet\" href=\"../css/shell.css\" />
  <link rel=\"stylesheet\" href=\"../css/components.css\" />
  <link rel=\"stylesheet\" href=\"../css/legacy-views.css\" />
  {cdn}
</head>
<body class=\"standalone-view\" data-page=\"{page_id}\">
  <div id=\"app-shell\"></div>
  <main class=\"page-main\" id=\"page-main\">
{html}
{extra}
  </main>
  <script src=\"../js/api.js\"></script>
  <script src=\"../js/runtime-core.js\"></script>
  <script src=\"../js/shell.js\"></script>
  <script src=\"../js/pages/{page_id}.js\"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: '{page_id}', title: '{title}', subtitle: '{subtitle}' }});
    {boot}
  </script>
</body>
</html>
"""
    (ROOT / relpath).write_text(page, encoding="utf-8")
    print("wrote", relpath, "html", len(html), "js", len(js))


def main():
    # Fix discovery/evolution markers by scanning
    for label in re.findall(r"\n// ={5,} [^\n]+", portal[420000:520000]):
        if any(k in label for k in ("Discovery", "Evolution", "Match", "QA", "Collection", "发现", "演化")):
            print("hdr", repr(label[:80]))

    for row in PAGES:
        try:
            write_page(*row)
        except Exception as e:
            print("FAIL", row[0], e)


if __name__ == "__main__":
    main()
