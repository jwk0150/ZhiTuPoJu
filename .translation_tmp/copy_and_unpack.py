# -*- coding: utf-8 -*-
"""Copy the desktop paper docx into workspace and unpack it."""
import os, shutil, sys

# 论文.docx (U+8BBA=论, U+6587=文)
src = os.path.expanduser("~") + "\\Desktop\\" + "\u8bba\u6587.docx"
work = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp"
dst = os.path.join(work, "paper_src.docx")

print("src exists:", os.path.exists(src))
if not os.path.exists(src):
    # list all docx on desktop to help debugging
    desktop = os.path.expanduser("~") + "\\Desktop"
    for f in os.listdir(desktop):
        if f.lower().endswith(".docx"):
            print("  desktop docx:", repr(f))
    sys.exit(1)

shutil.copy2(src, dst)
print("copied to", dst, os.path.getsize(dst))
