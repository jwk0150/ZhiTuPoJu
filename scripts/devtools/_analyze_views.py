# -*- coding: utf-8 -*-
from pathlib import Path
import re

t = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")
for vid in [
    "view-dashboard",
    "view-discovery",
    "view-evolution",
    "view-match",
    "view-qa",
    "view-collection",
    "view-analysis",
    "view-quality",
    "view-settings",
    "view-map",
    "view-learningPath",
    "view-newSkill",
]:
    i = t.find(f'id="{vid}"')
    print(vid, "pos", i)

# find section ends for map and match
def extract_section(text, view_id):
    # find <section ... id="view_id"
    m = re.search(rf'<section[^>]*id="{re.escape(view_id)}"[^>]*>', text)
    if not m:
        return None, None
    start = m.start()
    # find next <section class="view" or </section> matching depth
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
                return start, pos
    return start, None

for vid in ["view-map", "view-match"]:
    s, e = extract_section(t, vid)
    print(vid, "span", s, e, "len", (e - s) if s is not None and e else None)

# JS markers
for kw in ["window.initTalentMap", "window.matchState", "window.runMatchFromFile", "CareerFit Match JS", "// ============== Match View"]:
    print(kw, t.find(kw))
