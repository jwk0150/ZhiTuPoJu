# -*- coding: utf-8 -*-
"""Dump OCR blocks that were NOT translated for an image."""
import json, io, sys, unicodedata, re

data = json.load(io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_data.json", encoding="utf-8"))

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("\u2019", "'").replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip().lower()

# load translation dictionaries
import importlib
all_keys = set()
for mod in ["img23_trans", "img4_trans", "img59_trans"]:
    m = importlib.import_module(mod)
    td = getattr(m, "IMG_TRANS")
    for d in td.values():
        all_keys.update(norm(k) for k in d.keys())

img = sys.argv[1]
for i, b in enumerate(data[img]):
    t = b["text"]
    if norm(t) in all_keys:
        continue
    print("%d\t%s\t| %s" % (i, "%d,%d" % (b["x"], b["y"]), t))
