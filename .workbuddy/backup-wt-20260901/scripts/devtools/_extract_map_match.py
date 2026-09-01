# -*- coding: utf-8 -*-
"""Extract map/match views from portal into standalone multipage assets."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORTAL = ROOT / "frontend" / "portal.html"
OUT = ROOT / "frontend"


def extract_section(text: str, view_id: str) -> str:
    m = re.search(rf'<section[^>]*id="{re.escape(view_id)}"[^>]*>', text)
    if not m:
        raise SystemExit(f"missing section {view_id}")
    start = m.start()
    i = m.end()
    depth = 1
    pos = i
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
                return text[start:pos]
    raise SystemExit(f"unclosed section {view_id}")


def main() -> None:
    t = PORTAL.read_text(encoding="utf-8", errors="replace")

    # 1) legacy CSS (first big <style> in head)
    sm = re.search(r"<style>([\s\S]*?)</style>", t)
    if not sm:
        raise SystemExit("no style block")
    css = sm.group(1)
    # neutralize full-page portal assumptions that break shell pages
    css = (
        "/* Extracted from portal.html for standalone module pages */\n"
        + css
        + """
/* Standalone page overrides */
body.standalone-view { overflow: auto !important; }
body.standalone-view .view { display: block !important; animation: none !important; }
body.standalone-view .page-main { padding: 0 !important; }
body.standalone-view #page-main > .view { min-height: calc(100vh - var(--topbar-h, 60px)); }
"""
    )
    (OUT / "css" / "legacy-views.css").write_text(css, encoding="utf-8")
    print("wrote legacy-views.css", len(css))

    # 2) runtime core: Utils + API_BASE + light Store
    utils_start = t.find("window.Utils = {")
    utils_end = t.find("window.Store = {", utils_start)
    store_start = utils_end
    # Store object until next window.XXX at same level - take until generateAllData or switchView-ish
    store_end = t.find("\nwindow.API_BASE", store_start)
    if store_end < 0:
        store_end = t.find("\n// ============== Dashboard", store_start)
    utils_block = t[utils_start:utils_end]
    # Minimal store: keep state object if present
    store_snip = t[store_start : store_start + 2500]
    # Prefer a tiny stub instead of huge Store
    runtime = f"""/* Shared runtime extracted for standalone pages */
window.API_BASE = window.API_BASE || 'http://127.0.0.1:5000';
{utils_block}
window.Store = window.Store || {{
  state: {{ jobs: [], newJobs: [], skills: [], activities: [] }},
  get: function(k) {{ return this.state[k]; }},
  set: function(k, v) {{ this.state[k] = v; }}
}};
if (!window.Utils.showToast) {{
  window.Utils.showToast = function(msg, tone) {{
    if (window.showToast) return window.showToast(msg, tone);
    console.log('[toast]', tone, msg);
  }};
}}
"""
    (OUT / "js" / "runtime-core.js").write_text(runtime, encoding="utf-8")
    print("wrote runtime-core.js", len(runtime))
    print("store snip preview bytes", len(store_snip))

    # 3) map HTML + JS
    map_html = extract_section(t, "view-map")
    # make view always visible
    map_html = map_html.replace('class="view"', 'class="view active"', 1)
    map_js_start = t.find("const talentMapState") 
    if map_js_start < 0:
        map_js_start = t.find("var talentMapState")
    if map_js_start < 0:
        map_js_start = t.find("talentMapState =")
    # better: find line with talentMapState declaration near 593676
    map_js_start = t.find("\n", 593600) + 1
    # Actually use exact: search backwards from initTalentMap for "let talentMapState" or similar
    init = t.find("window.initTalentMap")
    # include state object: search 'talentMapState' definition
    mdef = re.search(r"(?:window\.)?talentMapState\s*=\s*\{", t[init - 5000 : init])
    if mdef:
        map_js_start = init - 5000 + mdef.start()
    else:
        map_js_start = t.rfind("talentMapState", 0, init)
        map_js_start = t.rfind("\n", 0, map_js_start) + 1
    map_js_end = t.find("\n// ============== Learning Path View", init)
    if map_js_end < 0:
        map_js_end = t.find("\n// ============== 学习路径", init)
    map_js = t[map_js_start:map_js_end]
    map_js = map_js.replace("fetch('china-geo.json')", "fetch('../assets/china-geo.json')")
    map_js = map_js.replace('fetch("china-geo.json")', 'fetch("../assets/china-geo.json")')
    map_js += """
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.initTalentMap === 'function') {
    window.initTalentMap();
  }
});
"""
    (OUT / "js" / "pages" / "map.js").write_text(map_js, encoding="utf-8")
    print("wrote map.js", len(map_js), "start", map_js_start, "end", map_js_end)

    # 4) match HTML + competitiveness modal
    match_html = extract_section(t, "view-match")
    match_html = match_html.replace('class="view"', 'class="view active"', 1)
    modal_i = t.find('id="competitiveness-modal"')
    modal = ""
    if modal_i > 0:
        ms = t.rfind("<div", 0, modal_i)
        # take until closing of modal block - look for match-comp-modal end before trend or body end
        me = t.find("<!-- CareerFit", ms)
        # already at comment; find modal after comment
        ms2 = t.find('<div class="match-comp-modal"', ms)
        if ms2 > 0:
            # crude end: next <!-- or </body>
            me2 = t.find("\n\n</body>", ms2)
            # find after modal: consecutive closing divs - take until blank line after modal
            end_marker = t.find("</div>\n</div>\n\n", ms2)
            if end_marker > 0:
                modal = t[ms2 : end_marker + len("</div>\n</div>")]
            else:
                modal = t[ms2 : ms2 + 800]

    match_js_start = t.find("// ============== Match View")
    match_js_end = t.find("// ============== QA View", match_js_start)
    match_js = t[match_js_start:match_js_end]
    # CareerFit block
    cf = t.find("/* === CareerFit Match JS")
    if cf < 0:
        cf = t.find("window.flipModeCard")
    cf_end = t.find("window.__openCareerFitComp")
    if cf_end > 0:
        cf_end = t.find("\n};\n", cf_end) + 4
        # include __openCareerFitComp function fully
        cf_end = t.find("</script>", cf)
        career = t[cf:cf_end]
    else:
        career = ""
    match_js = match_js + "\n" + career
    match_js += """
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.initMatchView === 'function') window.initMatchView();
  else if (typeof window.initMatch === 'function') window.initMatch();
  else if (typeof window.bindMatchUpload === 'function') window.bindMatchUpload();
  // ensure upload zone wired
  const input = document.getElementById('resume-file-input');
  if (input && typeof window.runMatchFromFile === 'function') {
    // initMatchView usually wires this; no-op if already bound
  }
});
"""
    (OUT / "js" / "pages" / "match.js").write_text(match_js, encoding="utf-8")
    print("wrote match.js", len(match_js))

    # move geo json
    geo_src = OUT / "china-geo.json"
    geo_dst = OUT / "assets" / "china-geo.json"
    geo_dst.parent.mkdir(parents=True, exist_ok=True)
    if geo_src.exists() and not geo_dst.exists():
        geo_dst.write_bytes(geo_src.read_bytes())
        print("copied china-geo.json to assets")
    elif geo_src.exists():
        geo_dst.write_bytes(geo_src.read_bytes())
        print("updated assets/china-geo.json")

    # write page shells
    map_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · 数字人才地图</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/shell.css" />
  <link rel="stylesheet" href="../css/components.css" />
  <link rel="stylesheet" href="../css/legacy-views.css" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body class="standalone-view" data-page="map">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
{map_html}
  </main>
  <script src="../js/api.js"></script>
  <script src="../js/runtime-core.js"></script>
  <script src="../js/shell.js"></script>
  <script src="../js/pages/map.js"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: 'map', title: '数字人才地图', subtitle: '区域人才与岗位能力空间洞察' }});
  </script>
</body>
</html>
"""
    (OUT / "pages" / "map.html").write_text(map_page, encoding="utf-8")
    print("wrote pages/map.html", len(map_page))

    match_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · 人岗匹配诊断</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/shell.css" />
  <link rel="stylesheet" href="../css/components.css" />
  <link rel="stylesheet" href="../css/legacy-views.css" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
</head>
<body class="standalone-view" data-page="match">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
{match_html}
  </main>
{modal}
  <script src="../js/api.js"></script>
  <script src="../js/runtime-core.js"></script>
  <script src="../js/shell.js"></script>
  <script src="../js/pages/match.js"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: 'match', title: '人岗匹配诊断', subtitle: '简历诊断与竞争力对比' }});
  </script>
</body>
</html>
"""
    (OUT / "pages" / "match.html").write_text(match_page, encoding="utf-8")
    print("wrote pages/match.html", len(match_page))
    print("DONE")


if __name__ == "__main__":
    main()
