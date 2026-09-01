# -*- coding: utf-8 -*-
import re
from pathlib import Path

local = Path(r"c:\Users\Ibiza\Desktop\project\挑战杯\frontend\js\pages\map.js").read_text(encoding="utf-8")
remote = Path(r"C:\Users\Ibiza\AppData\Local\Temp\ls_map.js").read_text(encoding="utf-8", errors="replace")
out = Path(r"c:\Users\Ibiza\Desktop\project\挑战杯\scripts\devtools\_graph_diff.txt")

chunks = []
for name, src in [("LOCAL", local), ("LS_NEW1", remote)]:
    chunks.append(f"\n===== {name} job card build =====\n")
    i = src.find("进入知识图谱")
    chunks.append(src[max(0, i - 900) : i + 180])
    chunks.append(f"\n===== {name} talentMapEnterGraph =====\n")
    m = re.search(r"window\.talentMapEnterGraph\s*=\s*function", src)
    if m:
        chunks.append(src[m.start() : m.start() + 2500])
    chunks.append(f"\n===== {name} G6 Graph style snippet =====\n")
    m = re.search(r"new G6\.Graph\(\{", src)
    if m:
        chunks.append(src[m.start() : m.start() + 1800])

out.write_text("".join(chunks), encoding="utf-8")
print("wrote", out, "bytes", out.stat().st_size)
