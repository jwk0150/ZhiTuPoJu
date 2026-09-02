# -*- coding: utf-8 -*-
from pathlib import Path
import re

portal = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")


def extract_section(text, view_id):
    m = re.search(rf'<section[^>]*id="{re.escape(view_id)}"[^>]*>', text)
    if not m:
        raise SystemExit("missing view " + view_id)
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
                return text[start:pos].replace('class="view"', 'class="view active"', 1)
    raise SystemExit("unclosed " + view_id)


def slice_js(start_pat, end_pat):
    s = portal.find(start_pat)
    e = portal.find(end_pat, s + 5) if s >= 0 else -1
    if s < 0 or e < 0:
        print("WARN JS", start_pat, "->", end_pat, "s", s, "e", e)
        return f"/* JS not found: {start_pat} -> {end_pat} */\n"
    return portal[s:e]


# Collection includes Trend Data helpers used by analysis? Keep collection slim.
MORE = [
    (
        "collection",
        "view-collection",
        "数据采集",
        "多源异构数据采集任务",
        "// ============== Collection View ==============",
        "// ============== Trend Data ==============",
        "",
        "window.initCollection && window.initCollection();",
    ),
    (
        "analysis",
        "view-analysis",
        "趋势分析",
        "岗位与技能趋势洞察",
        "// ============== Trend Data ==============",
        "// ============== Quality View ==============",
        '<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>\n  <script src="../../trends-mock.js"></script>',
        "window.initAnalysis && window.initAnalysis();",
    ),
    (
        "quality",
        "view-quality",
        "质量监控",
        "数据质量与覆盖监控",
        "// ============== Quality View ==============",
        "// ============== Settings View ==============",
        "",
        "window.initQuality && window.initQuality();",
    ),
    (
        "settings",
        "view-settings",
        "系统设置",
        "平台与服务配置",
        "// ============== Settings View ==============",
        "// ============== Graph View ==============",
        "",
        "window.initSettings && window.initSettings();",
    ),
]

for page_id, view_id, title, subtitle, js_s, js_e, cdn, boot in MORE:
    html = extract_section(portal, view_id)
    js = slice_js(js_s, js_e)
    Path(f"frontend/js/pages/{page_id}.js").write_text(js + "\n", encoding="utf-8")
    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · {title}</title>
  <link rel="stylesheet" href="../../css/tokens.css" />
  <link rel="stylesheet" href="../../css/shell.css" />
  <link rel="stylesheet" href="../../css/components.css" />
  <link rel="stylesheet" href="../../css/legacy-views.css" />
  {cdn}
</head>
<body class="standalone-view" data-page="{page_id}">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
{html}
  </main>
  <script src="../../js/api.js"></script>
  <script src="../../js/runtime-core.js"></script>
  <script src="../../js/shell.js"></script>
  <script src="../../js/pages/{page_id}.js"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: '{page_id}', title: '{title}', subtitle: '{subtitle}' }});
    {boot}
  </script>
</body>
</html>
"""
    Path(f"frontend/pages/more/{page_id}.html").write_text(page, encoding="utf-8")
    print("wrote more/" + page_id, "html", len(html), "js", len(js))
