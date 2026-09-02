# -*- coding: utf-8 -*-
"""Parse ocr2.txt into structured JSON per image."""
import re, json, io

SRC = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr2.txt"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_data.json"

lines = io.open(SRC, encoding="utf-8").read().splitlines()
data = {}
cur = None
pat = re.compile(r"^\s*box=\((\d+),(\d+),(\d+),(\d+)\) score=([\d.]+)\s*(.*)$")
for ln in lines:
    if ln.startswith("====="):
        cur = ln.strip("= ")
        data[cur] = []
        continue
    m = pat.match(ln)
    if m and cur:
        x, y, w, h = map(int, m.groups()[:4])
        score = float(m.group(5))
        text = m.group(6).strip()
        data[cur].append({"x": x, "y": y, "w": w, "h": h, "score": score, "text": text})

json.dump(data, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, v in data.items():
    print(k, len(v))
