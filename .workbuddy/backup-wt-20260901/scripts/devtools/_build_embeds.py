# -*- coding: utf-8 -*-
from pathlib import Path
import re

ROOT = Path("frontend")


def main_inner(html: str) -> str:
    m = re.search(r'<main[^>]*id="page-main"[^>]*>(.*?)</main>', html, re.S)
    if not m:
        m = re.search(r"<main[^>]*>(.*?)</main>", html, re.S)
    return m.group(1).strip() if m else ""


# Profile embed from current pages/profile.html
prof = (ROOT / "pages/profile.html").read_text(encoding="utf-8")
pbody = main_inner(prof)
(ROOT / "pages/profile-embed.html").write_text(
    f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>我的档案</title>
  <link rel="stylesheet" href="../css/profile.css" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <style>html,body{{margin:0;background:#080c14;min-height:100%}}</style>
</head>
<body class="profile-page">
{pbody}
  <script src="../js/api.js"></script>
  <script src="../js/pages/profile.js"></script>
</body>
</html>
""",
    encoding="utf-8",
)
print("profile-embed", len(pbody))

# QA: recover from archive portal if pages/qa is redirect
qa_path = ROOT / "pages/qa.html"
qa_text = qa_path.read_text(encoding="utf-8")
if "location.replace" in qa_text or len(qa_text) < 2000:
    portal = Path("scripts/devtools/archive-frontend/portal.html").read_text(
        encoding="utf-8", errors="replace"
    )
    # extract view-qa section
    m = re.search(r'<section[^>]*id="view-qa"[^>]*>', portal)
    if not m:
        raise SystemExit("view-qa missing in archive")
    start = m.start()
    pos = m.end()
    depth = 1
    while pos < len(portal) and depth:
        o = portal.find("<section", pos)
        c = portal.find("</section>", pos)
        if c < 0:
            break
        if o >= 0 and o < c:
            depth += 1
            pos = o + 8
        else:
            depth -= 1
            pos = c + len("</section>")
    section = portal[start:pos].replace('class="view"', 'class="view active"', 1)
    # JS from archive between QA markers
    js_s = portal.find("// ============== QA View")
    js_e = portal.find("// ============== Collection", js_s + 5)
    qa_js = portal[js_s:js_e] if js_s > 0 and js_e > js_s else Path("frontend/js/pages/qa.js").read_text(encoding="utf-8")
    Path("frontend/js/pages/qa.js").write_text(qa_js + "\n", encoding="utf-8")
    (ROOT / "pages/qa-embed.html").write_text(
        f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>智能问答</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/legacy-views.css" />
  <style>
    html,body{{margin:0;height:100%;background:#F4F7F8}}
    .view{{display:block!important;padding:8px 12px 16px}}
    .page-header h1{{font-size:18px}}
  </style>
</head>
<body>
{section}
  <script src="../js/api.js"></script>
  <script src="../js/runtime-core.js"></script>
  <script src="../js/pages/qa.js"></script>
  <script>window.initQA && window.initQA();</script>
</body>
</html>
""",
        encoding="utf-8",
    )
    print("qa-embed from archive", len(section))
else:
    qbody = main_inner(qa_text)
    (ROOT / "pages/qa-embed.html").write_text(
        f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/legacy-views.css" />
  <style>html,body{{margin:0;height:100%;background:#F4F7F8}}.view{{display:block!important}}</style>
</head>
<body>
{qbody}
  <script src="../js/api.js"></script>
  <script src="../js/runtime-core.js"></script>
  <script src="../js/pages/qa.js"></script>
  <script>window.initQA&&window.initQA();</script>
</body>
</html>
""",
        encoding="utf-8",
    )
    print("qa-embed from page", len(qbody))

# Redirects for profile / qa (keep profile-embed)
(ROOT / "pages/profile.html").write_text(
    """<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8" />
<meta http-equiv="refresh" content="0; url=match.html?tab=profile" />
<script>location.replace('match.html?tab=profile');</script>
<title>跳转中</title>
</head><body><a href="match.html?tab=profile">档案已并入匹配</a></body></html>
""",
    encoding="utf-8",
)
(ROOT / "pages/qa.html").write_text(
    """<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8" />
<script>
  try { sessionStorage.setItem('shell_qa_open', '1'); } catch (e) {}
  location.replace('home.html');
</script>
<title>跳转中</title>
</head><body><a href="home.html">问答已改为全局浮层</a></body></html>
""",
    encoding="utf-8",
)
print("done")
