# -*- coding: utf-8 -*-
from pathlib import Path
import re

local = Path("frontend/js/pages/map.js").read_text(encoding="utf-8")
remote = Path(r"C:\Users\Ibiza\AppData\Local\Temp\ls_map.js").read_text(encoding="utf-8", errors="replace")
out = []
for name, src in [("LOCAL", local), ("LS", remote)]:
    m = re.search(r"TECH_CATEGORY_COLORS\s*=\s*\{[\s\S]*?\n\};", src)
    out.append(f"==== {name} COLORS ====\n{(m.group(0) if m else 'missing')}\n")
    # center style fill
    m = re.search(r"centerStyle\s*=\s*\{[\s\S]{0,350}\}", src)
    out.append(f"==== {name} centerStyle ====\n{(m.group(0) if m else 'missing')}\n")
    # ability aggregate comment
    m = re.search(r"window\.talentOpenAbility[\s\S]{0,800}", src)
    out.append(f"==== {name} openAbility ====\n{(m.group(0)[:600] if m else 'missing')}\n")

Path("scripts/devtools/_graph_style_cmp.txt").write_text("\n".join(out), encoding="utf-8")
print("ok")
