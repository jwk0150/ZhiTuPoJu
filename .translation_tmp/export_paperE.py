# -*- coding: utf-8 -*-
import os, shutil, ctypes
from ctypes import wintypes

# get real Desktop path via SHGetFolderPath (handles OneDrive/redirected folders)
SHGFP_TYPE_CURRENT = 0
CSIDL_DESKTOPDIRECTORY = 0x0010
buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOPDIRECTORY, None, SHGFP_TYPE_CURRENT, buf)
desktop = buf.value
print("desktop:", repr(desktop), "exists:", os.path.isdir(desktop))

base = r"d:\Learning_test\backup3\ZhiTuPoJu"
src = os.path.join(base, "\u8bba\u6587E.docx")
dst = os.path.join(desktop, "\u8bba\u6587E.docx")
if os.path.exists(dst):
    os.remove(dst)
shutil.copy(src, dst)
print("copied:", repr(os.path.basename(dst)), os.path.getsize(dst))
print("on desktop:", os.path.exists(dst))
