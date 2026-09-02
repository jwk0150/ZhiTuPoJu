# -*- coding: utf-8 -*-
import os, shutil, glob

base = r"d:\Learning_test\backup3\ZhiTuPoJu"
src = os.path.join(base, "paper_EN.docx")
dst = os.path.join(base, "\u8bba\u6587E.docx")  # 论文E.docx

# remove wrongly-named file if any
for f in glob.glob(os.path.join(base, "*E.docx")):
    if os.path.basename(f) != "paper_EN.docx" and f != dst:
        try:
            os.remove(f)
            print("removed wrong file:", repr(os.path.basename(f)))
        except Exception as e:
            print("rm fail:", e)

if os.path.exists(dst):
    os.remove(dst)
shutil.copy(src, dst)
print("created:", repr(os.path.basename(dst)), os.path.getsize(dst))

# verify listing
for f in os.listdir(base):
    if f.endswith(".docx"):
        print("  -", repr(f))
