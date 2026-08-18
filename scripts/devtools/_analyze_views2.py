# -*- coding: utf-8 -*-
from pathlib import Path
import re

t = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")

# Map JS: from initTalentMap / talentMapState definition
# Find talentMapState first assignment
for kw in ["talentMapState", "window.initTalentMap", "window.switchView", "// ============== QA", "// ============== Collection", "window.initMatch"]:
    print(repr(kw), t.find(kw))

# Find script tags
scripts = list(re.finditer(r"<script[^>]*>", t))
print("script tags", len(scripts))
# last big inline script start
for m in scripts[-5:]:
    print("script@", m.start(), t[m.start():m.start()+80].replace("\n"," "))

# Rough: match block ends before QA view init or next major // ====
match_start = t.find("// ============== Match View")
# find next // ============== after match
m = re.search(r"\n// ={5,} [^=\n]+", t[match_start+10:])
print("after match header", m.group(0) if m else None, "at", (match_start+10+m.start()) if m else None)

# CareerFit end
cf = t.find("CareerFit Match JS")
print("careerfit", cf)
m2 = re.search(r"\n// ={5,}|\n/\* ===", t[cf+10:cf+50000])
print("after careerfit", (m2.group(0)[:40] if m2 else None), "rel", m2.start() if m2 else None)

# map js end: search for next major section after initTalentMap
map_start = t.find("window.initTalentMap")
# go back to talentMapState = 
tm = t.rfind("talentMapState", 0, map_start)
print("talentMapState before init", tm)
# find window.xxx = after a long stretch - look for // ==== Analysis or trends
for kw in ["window.initTrends", "window.renderTrends", "// Talent Map", "/* Talent", "window.switchView"]:
    idx = t.find(kw, map_start)
    print("after map", kw, idx)
