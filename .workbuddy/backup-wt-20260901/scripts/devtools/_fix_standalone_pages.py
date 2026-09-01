# -*- coding: utf-8 -*-
from pathlib import Path
import re

portal = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")
match_page = Path("frontend/pages/match.html").read_text(encoding="utf-8", errors="replace")

# extract modal-overlay block
i = portal.find('<div class="modal-overlay" id="modal-overlay">')
if i < 0:
    raise SystemExit("modal missing")
# find matching close - next major sibling comment or section after modal
# take until <!-- ============== 6. or similar after settings - actually modal is near end of views
# Use depth count for div
pos = i + len('<div class="modal-overlay" id="modal-overlay">')
depth = 1
while pos < len(portal) and depth:
    nxt_open = portal.find("<div", pos)
    nxt_close = portal.find("</div>", pos)
    if nxt_close < 0:
        break
    if nxt_open >= 0 and nxt_open < nxt_close:
        depth += 1
        pos = nxt_open + 4
    else:
        depth -= 1
        pos = nxt_close + 6
modal = portal[i:pos]
print("modal len", len(modal))

if 'id="modal-overlay"' not in match_page:
    match_page = match_page.replace("</main>", "</main>\n" + modal + "\n", 1)
    Path("frontend/pages/match.html").write_text(match_page, encoding="utf-8")
    print("modal injected")
else:
    print("modal already present")

# Ensure initMatch is called after shell mount - shell moves DOM; order matters!
# Currently scripts: match.js then Shell.mount. initMatch on DOMContentLoaded may run BEFORE shell moves nodes - still fine if nodes exist.
# But Shell.mount moves #page-main - IDs still work.

# Fix script order: mount shell first, then initMatch
if "Shell.mount" in match_page and "initMatch()" in match_page:
    match_page = Path("frontend/pages/match.html").read_text(encoding="utf-8")
# rewrite boot
match_page = re.sub(
    r"<script>\s*window\.Shell && window\.Shell\.mount\(\{[\s\S]*?\}\);\s*</script>\s*</body>",
    """<script>
    window.Shell && window.Shell.mount({ pageId: 'match', title: '人岗匹配诊断', subtitle: '简历诊断与竞争力对比' });
    if (typeof window.initMatch === 'function') window.initMatch();
  </script>
</body>""",
    match_page,
    count=1,
)
# remove duplicate DOMContentLoaded auto if causes double bind - initMatch has dataset.bound guard OK
Path("frontend/pages/match.html").write_text(match_page, encoding="utf-8")
print("boot updated")

# map page: call init after mount
map_page = Path("frontend/pages/map.html").read_text(encoding="utf-8")
map_page = re.sub(
    r"<script>\s*window\.Shell && window\.Shell\.mount\(\{[\s\S]*?\}\);\s*</script>\s*</body>",
    """<script>
    window.Shell && window.Shell.mount({ pageId: 'map', title: '数字人才地图', subtitle: '区域人才与岗位能力空间洞察' });
    if (typeof window.initTalentMap === 'function') window.initTalentMap();
  </script>
</body>""",
    map_page,
    count=1,
)
Path("frontend/pages/map.html").write_text(map_page, encoding="utf-8")
print("map boot updated")
