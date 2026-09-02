# -*- coding: utf-8 -*-
"""Extract unique OCR texts for dictionary building."""
import json, io, unicodedata, re

data = json.load(io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_data.json", encoding="utf-8"))

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # strip accents
    return s.lower().replace("\u2019", "'").replace("\xa0", " ")

seen = {}
for img, blocks in data.items():
    for b in blocks:
        t = b["text"]
        if not t.strip():
            continue
        key = norm(t)
        if key not in seen:
            seen[key] = {"text": t, "imgs": []}
        seen[key]["imgs"].append(img)

out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unique_ocr.txt", "w", encoding="utf-8")
for key, info in sorted(seen.items(), key=lambda kv: kv[0]):
    out.write("%s\t| %s | %s\n" % (key, info["text"], ",".join(sorted(set(info["imgs"])))))
out.close()
print("unique:", len(seen))
