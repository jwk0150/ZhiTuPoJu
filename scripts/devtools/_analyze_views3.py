# -*- coding: utf-8 -*-
from pathlib import Path
import re

t = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")
start = 593676  # talentMapState
chunk = t[start : start + 140000]
headers = list(re.finditer(r"\n// ={5,}[^\n]*", chunk))
print("headers in map region:")
for h in headers[:30]:
    print(start + h.start(), repr(h.group(0)[:80]))

# also function window.xxx near end of map
# find </script> after map
script_end = t.find("</script>", 593676)
print("first </script> after map start", script_end)

# CareerFit is after 734527 - which script?
print("script containing careerfit: look backwards for <script")
print(t.rfind("<script", 0, 734527))
print(t[t.rfind("<script", 0, 734527) : t.rfind("<script", 0, 734527) + 60])

# Match deps: Utils, Store, API_BASE
match_js = t[438525:466322]
for dep in ["window.Utils", "window.Store", "API_BASE", "gsap", "echarts", "showToast", "fetch("]:
    print("match dep", dep, match_js.count(dep))

map_js = t[593676:script_end if script_end > 0 else 593676 + 120000]
print("map_js len approx", len(map_js))
for dep in ["window.Utils", "window.Store", "API_BASE", "echarts", "china-geo", "fetch("]:
    print("map dep", dep, map_js.count(dep))
