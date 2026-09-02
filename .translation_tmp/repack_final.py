# -*- coding: utf-8 -*-
import os, zipfile

SRC = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\paper_translated.docx"

if os.path.exists(OUT):
    os.remove(OUT)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(SRC):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, SRC).replace("\\", "/")
            zf.write(full, rel)
print("packed:", OUT, os.path.getsize(OUT))
