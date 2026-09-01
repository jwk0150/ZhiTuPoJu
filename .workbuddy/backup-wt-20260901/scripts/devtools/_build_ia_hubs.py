# -*- coding: utf-8 -*-
"""Assemble insight/data hub pages and redirect stubs for IA consolidation."""
from pathlib import Path
import re

ROOT = Path("frontend")


def extract_main_inner(html_path: Path) -> str:
    text = html_path.read_text(encoding="utf-8")
    m = re.search(r'<main[^>]*id="page-main"[^>]*>(.*?)</main>', text, re.S)
    if not m:
        raise SystemExit(f"no main in {html_path}")
    return m.group(1).strip()


def write_redirect(path: Path, target: str, note: str):
    path.write_text(
        f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url={target}" />
  <script>location.replace('{target}');</script>
  <title>跳转中</title>
</head>
<body><a href="{target}">{note}</a></body>
</html>
""",
        encoding="utf-8",
    )


# --- insight: evolution + analysis ---
evo_inner = extract_main_inner(ROOT / "pages/evolution.html")
# strip learning/newSkill sibling sections stay inside evo_inner - OK
ana_html = (ROOT / "pages/more/analysis.html").read_text(encoding="utf-8")
ana_m = re.search(r'<main[^>]*id="page-main"[^>]*>(.*?)</main>', ana_html, re.S)
ana_inner = ana_m.group(1).strip() if ana_m else ""
# deactivate analysis view class until tab selected - keep as section
ana_inner = ana_inner.replace('class="view active"', 'class="view"', 1)

insight = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · 岗位洞察</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/shell.css" />
  <link rel="stylesheet" href="../css/components.css" />
  <link rel="stylesheet" href="../css/legacy-views.css" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <script src="../trends-mock.js"></script>
</head>
<body class="standalone-view" data-page="insight">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
    <div class="hub-tabs" data-hub="insight">
      <button type="button" class="hub-tab active" data-hub-tab="evolution">能力演化</button>
      <button type="button" class="hub-tab" data-hub-tab="trends">宏观趋势</button>
    </div>
    <div class="hub-panel active" data-hub-panel="evolution">
{evo_inner}
    </div>
    <div class="hub-panel" data-hub-panel="trends">
{ana_inner}
    </div>
  </main>
  <script src="../js/api.js"></script>
  <script src="../js/runtime-core.js"></script>
  <script src="../js/shell.js"></script>
  <script src="../js/pages/evolution.js"></script>
  <script src="../js/pages/analysis.js"></script>
  <script src="../js/pages/hub-tabs.js"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: 'insight', title: '岗位洞察', subtitle: '能力演化与宏观趋势' }});
    window.initHubTabs && window.initHubTabs({{
      root: '[data-hub=insight]',
      onChange: function (tab) {{
        if (tab === 'evolution') {{
          window.initEvolution && window.initEvolution();
        }} else if (tab === 'trends') {{
          var view = document.getElementById('view-analysis');
          if (view) view.classList.add('active');
          window.initAnalysis && window.initAnalysis();
        }}
      }},
      initial: (new URLSearchParams(location.search).get('tab') === 'trends') ? 'trends' : 'evolution'
    }});
  </script>
</body>
</html>
"""
(ROOT / "pages/insight.html").write_text(insight, encoding="utf-8")
print("wrote insight.html", len(insight))

# --- data hub: collection + quality ---
col_inner = extract_main_inner(ROOT / "pages/more/collection.html")
qua_html = (ROOT / "pages/more/quality.html").read_text(encoding="utf-8")
qua_m = re.search(r'<main[^>]*id="page-main"[^>]*>(.*?)</main>', qua_html, re.S)
qua_inner = qua_m.group(1).strip() if qua_m else ""
qua_inner = qua_inner.replace('class="view active"', 'class="view"', 1)

data = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>执图破局 · 数据底座</title>
  <link rel="stylesheet" href="../../css/tokens.css" />
  <link rel="stylesheet" href="../../css/shell.css" />
  <link rel="stylesheet" href="../../css/components.css" />
  <link rel="stylesheet" href="../../css/legacy-views.css" />
</head>
<body class="standalone-view" data-page="data">
  <div id="app-shell"></div>
  <main class="page-main" id="page-main">
    <div class="hub-tabs" data-hub="data">
      <button type="button" class="hub-tab active" data-hub-tab="collection">数据采集</button>
      <button type="button" class="hub-tab" data-hub-tab="quality">质量监控</button>
    </div>
    <div class="hub-panel active" data-hub-panel="collection">
{col_inner}
    </div>
    <div class="hub-panel" data-hub-panel="quality">
{qua_inner}
    </div>
  </main>
  <script src="../../js/api.js"></script>
  <script src="../../js/runtime-core.js"></script>
  <script src="../../js/shell.js"></script>
  <script src="../../js/pages/collection.js"></script>
  <script src="../../js/pages/quality.js"></script>
  <script src="../../js/pages/hub-tabs.js"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: 'data', title: '数据底座', subtitle: '采集任务与质量覆盖' }});
    window.initHubTabs && window.initHubTabs({{
      root: '[data-hub=data]',
      onChange: function (tab) {{
        if (tab === 'collection') window.initCollection && window.initCollection();
        if (tab === 'quality') {{
          var view = document.getElementById('view-quality');
          if (view) view.classList.add('active');
          window.initQuality && window.initQuality();
        }}
      }},
      initial: (new URLSearchParams(location.search).get('tab') === 'quality') ? 'quality' : 'collection'
    }});
  </script>
</body>
</html>
"""
(ROOT / "pages/more/data.html").write_text(data, encoding="utf-8")
print("wrote more/data.html", len(data))

# redirects
write_redirect(ROOT / "pages/evolution.html", "insight.html", "进入岗位洞察")
write_redirect(ROOT / "pages/more/analysis.html", "../insight.html?tab=trends", "进入宏观趋势")
write_redirect(ROOT / "pages/more/collection.html", "data.html", "进入数据底座")
write_redirect(ROOT / "pages/more/quality.html", "data.html?tab=quality", "进入质量监控")
write_redirect(ROOT / "pages/qa.html", "home.html#qa", "问答已改为全局浮层")
write_redirect(ROOT / "pages/profile.html", "match.html?tab=profile", "档案已并入匹配")

print("redirects ok")
