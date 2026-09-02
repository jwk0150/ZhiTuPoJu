# -*- coding: utf-8 -*-
import os, json, io, re
from rapidocr_onnxruntime import RapidOCR

MEDIA = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr2.txt"

engine = RapidOCR()
out = io.open(OUT, "w", encoding="utf-8")

def has_cjk(s):
    return bool(re.search(r"[\u4e00-\u9fff]", s))

for n in sorted(os.listdir(MEDIA)):
    p = os.path.join(MEDIA, n)
    out.write("===== %s =====\n" % n)
    res, _ = engine(p)
    if not res:
        out.write("  (no text)\n")
        continue
    for line in res:
        box, text, score = line[0], line[1], float(line[2])
        flag = "CJK" if has_cjk(text) else ""
        out.write("  box=(%d,%d,%d,%d) score=%.2f %s %s\n" % (
            int(box[0][0]), int(box[0][1]), int(box[2][0]-box[0][0]), int(box[2][1]-box[0][1]),
            score, flag, text))
    out.flush()
out.close()
print("done")
