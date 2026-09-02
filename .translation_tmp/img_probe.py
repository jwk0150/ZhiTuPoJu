# -*- coding: utf-8 -*-
"""Probe image sizes and background colors."""
from PIL import Image
import os

MEDIA = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media"
for n in sorted(os.listdir(MEDIA)):
    p = os.path.join(MEDIA, n)
    im = Image.open(p).convert("RGB")
    w, h = im.size
    px = im.load()
    # sample corners and center
    pts = {
        "top-left": (5, 5), "top-right": (w-6, 5), "center": (w//2, h//2),
        "bottom-left": (5, h-6), "bottom-right": (w-6, h-6)
    }
    colors = {k: px[x, y] for k, (x, y) in pts.items()}
    print(n, "%dx%d" % (w, h), colors)
