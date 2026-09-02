# -*- coding: utf-8 -*-
"""Overlay English translations onto OCR French text regions."""
import json, io, os, unicodedata, re, sys
from PIL import Image, ImageDraw, ImageFont

MEDIA = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media"
OUTDIR = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\media_en"
os.makedirs(OUTDIR, exist_ok=True)
OCR = json.load(io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_data.json", encoding="utf-8"))

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\calibri.ttf",
    r"C:\Windows\Fonts\cambria.ttf",
]
def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("\u2019", "'").replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip().lower()

def bg_color(im, box):
    """Sample background color from the 4 edges of box region."""
    x, y, w, h = box
    px = im.load()
    samples = []
    pad = 2
    # top/bottom rows
    for xx in range(max(0, x), min(im.width, x + w), 4):
        samples.append(px[xx, max(0, y - pad)])
        samples.append(px[xx, min(im.height - 1, y + h + pad)])
    # left/right cols
    for yy in range(max(0, y), min(im.height, y + h), 4):
        samples.append(px[max(0, x - pad), yy])
        samples.append(px[min(im.width - 1, x + w + pad), yy])
    if not samples:
        return (255, 255, 255)
    r = sum(s[0] for s in samples) // len(samples)
    g = sum(s[1] for s in samples) // len(samples)
    b = sum(s[2] for s in samples) // len(samples)
    return (r, g, b)

def draw_block(im, box, text, bg):
    """Fill box with bg color, draw text fit inside."""
    x, y, w, h = box
    d = ImageDraw.Draw(im)
    # expand a bit to erase antialiasing
    pad = 2
    d.rectangle([x - pad, y - pad, x + w + pad, y + h + pad], fill=bg)
    if not text:
        return
    # choose font size based on height, shrink if too wide
    size = max(8, int(h * 0.85))
    # text color: dark on light bg, light on dark bg
    luminance = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    fg = (20, 20, 20) if luminance > 140 else (235, 235, 235)
    while size > 7:
        font = load_font(size)
        tw = d.textlength(text, font=font)
        if tw <= w + 2:
            break
        size -= 1
    th = size
    d.text((x, y + max(0, (h - th) // 2)), text, font=load_font(size), fill=fg)

def process(img, trans_dict):
    blocks = OCR[img]
    src = os.path.join(OUTDIR, img) if os.path.exists(os.path.join(OUTDIR, img)) else os.path.join(MEDIA, img)
    im = Image.open(src).convert("RGB")
    replaced = 0
    for b in blocks:
        key = norm(b["text"])
        if not key:
            continue
        if key in trans_dict:
            en = trans_dict[key]
            box = (b["x"], b["y"], b["w"], b["h"])
            bg = bg_color(im, box)
            draw_block(im, box, en, bg)
            replaced += 1
    out = os.path.join(OUTDIR, img)
    im.save(out)
    print("%s: replaced %d/%d" % (img, replaced, len(blocks)))

if __name__ == "__main__":
    modname = sys.argv[1]
    sys.path.insert(0, r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp")
    raw = __import__(modname).IMG_TRANS
    td = {img: {norm(k): v for k, v in d.items()} for img, d in raw.items()}
    for img in sorted(td.keys()):
        if os.path.exists(os.path.join(MEDIA, img)):
            process(img, td[img])
