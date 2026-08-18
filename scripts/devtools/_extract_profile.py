# -*- coding: utf-8 -*-
from pathlib import Path
import re

src = Path("frontend/profile.html").read_text(encoding="utf-8")
# If already redirected, restore from git? Check
if "location.replace('pages/profile.html')" in src or 'pages/profile.html' in src[:400]:
    # try to recover from pages embed was reading old content - need git show
    import subprocess
    src = subprocess.check_output(
        ["git", "show", "HEAD:frontend/profile.html"],
        cwd=".",
    ).decode("utf-8")
    print("restored profile.html from HEAD")

sm = re.search(r"<style>(.*?)</style>", src, re.S)
style = sm.group(1) if sm else ""
bm = re.search(r"<body>\s*(.*?)\s*<script>", src, re.S)
body = bm.group(1) if bm else ""
body = re.sub(r'<div class="topbar">.*?</div>\s*', "", body, count=1, flags=re.S)
jm = re.search(r"<script>(.*?)</script>\s*</body>", src, re.S)
js = jm.group(1) if jm else ""
js = js.replace(
    "var API='http://127.0.0.1:5000'",
    "var API=(window.API_BASE||'http://127.0.0.1:5000')",
)

style2 = style.replace("body{", ".profile-page{")
css = (
    "/* Profile page scoped under .profile-page */\n"
    ".profile-page {\n"
    "  --bg-deep:#080c14;\n"
    "}\n"
    + style2
    + "\n.profile-page .app{max-width:960px;margin:0 auto;padding:8px 8px 48px;}\n"
    + ".page-main.profile-page{background:var(--bg-deep,#080c14);min-height:calc(100vh - var(--topbar-h,56px));}\n"
)
Path("frontend/css/profile.css").write_text(css, encoding="utf-8")
Path("frontend/js/pages/profile.js").write_text(js.strip() + "\n", encoding="utf-8")

page = f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>执图破局 · 我的资料</title>
  <link rel=\"stylesheet\" href=\"../css/tokens.css\" />
  <link rel=\"stylesheet\" href=\"../css/shell.css\" />
  <link rel=\"stylesheet\" href=\"../css/components.css\" />
  <link rel=\"stylesheet\" href=\"../css/profile.css\" />
  <script src=\"https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js\"></script>
</head>
<body class=\"standalone-view\" data-page=\"profile\">
  <div id=\"app-shell\"></div>
  <main class=\"page-main profile-page\" id=\"page-main\">
{body}
  </main>
  <script src=\"../js/api.js\"></script>
  <script src=\"../js/shell.js\"></script>
  <script src=\"../js/pages/profile.js\"></script>
  <script>
    window.Shell && window.Shell.mount({{ pageId: 'profile', title: '我的资料', subtitle: '账户与画像' }});
  </script>
</body>
</html>
"""
Path("frontend/pages/profile.html").write_text(page, encoding="utf-8")

# Keep root profile as redirect for old links
Path("frontend/profile.html").write_text(
    """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=pages/profile.html" />
  <script>location.replace('pages/profile.html');</script>
  <title>执图破局 · 我的资料</title>
</head>
<body><a href="pages/profile.html">进入我的资料</a></body>
</html>
""",
    encoding="utf-8",
)
print("ok css", len(css), "js", len(js), "body", len(body))
