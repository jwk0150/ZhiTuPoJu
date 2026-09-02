# -*- coding: utf-8 -*-
import re, os, io
OUTDIR = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\blocks"
files = sorted(f for f in os.listdir(OUTDIR) if f.endswith(".xml") and not f.startswith("_"))
for fn in files:
    blk = io.open(os.path.join(OUTDIR, fn), encoding="utf-8").read()
    has_math = "<ns9:oMath" in blk
    has_img = "<ns0:drawing" in blk
    has_wt = "<ns0:t>" in blk or "<ns0:t " in blk
    has_mt = "<ns9:t>" in blk or "<ns9:t " in blk
    # count runs
    nruns = len(re.findall(r"<ns0:r>", blk))
    if has_math or has_img or has_mt:
        texts = re.findall(r"<(?:ns0|ns9):t(?:\s[^>]*)?>(.*?)</(?:ns0|ns9):t>", blk, re.S)
        joined = "".join(texts).replace("&amp;","&").replace("&#x2019;","'")
        print("%s math=%s img=%s mt=%s runs=%d | %s" % (fn, has_math, has_img, has_mt, nruns, joined[:120]))
