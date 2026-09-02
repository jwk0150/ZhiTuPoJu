# -*- coding: utf-8 -*-
"""Repack unpacked2 into a docx preserving OPC structure."""
import os, zipfile

SRC = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\论文(2)_EN.docx"

if os.path.exists(OUT):
    os.remove(OUT)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(SRC):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, SRC).replace("\\", "/")
            zf.write(full, rel)
print("packed:", OUT, os.path.getsize(OUT), "bytes")
