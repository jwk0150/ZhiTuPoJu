# -*- coding: utf-8 -*-
"""Build a clean login background: strip UI from 素材1, upscale, optional blend."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[2]
src = Image.open(ROOT / "素材1.png").convert("RGB")
w, h = src.size
sky = (236, 245, 252)

out = src.copy()
mask = Image.new("L", (w, h), 0)
md = ImageDraw.Draw(mask)

# Left brand text zone
md.rounded_rectangle((8, 20, int(w * 0.52), int(h * 0.55)), radius=48, fill=255)
# Right login card zone (typical mockup placement)
md.rounded_rectangle((int(w * 0.52), int(h * 0.06), w - 12, int(h * 0.92)), radius=40, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(26))

soft = src.filter(ImageFilter.GaussianBlur(48))
solid = Image.new("RGB", (w, h), sky)
tex = Image.blend(solid, soft, 0.4)
# Keep more of original art outside mask: use original where mask is low
# For masked areas, prefer tex but reintroduce bottom city by reducing mask at bottom
city_keep = Image.new("L", (w, h), 0)
cd = ImageDraw.Draw(city_keep)
cd.rectangle((0, int(h * 0.62), int(w * 0.55), h), fill=255)
city_keep = city_keep.filter(ImageFilter.GaussianBlur(30))
# mask_ui = mask but subtract city keep on left bottom
mask_arr = mask.load()
city_arr = city_keep.load()
for y in range(h):
    for x in range(min(w, int(w * 0.55))):
        m = mask_arr[x, y]
        c = city_arr[x, y]
        if c:
            mask_arr[x, y] = max(0, m - int(c * 0.85))

cleaned = Image.composite(tex, out, mask)

# Upscale to sharp 2880x1800 then export 1440x900 + 2x
hi = cleaned.resize((2880, 1800), Image.Resampling.LANCZOS)
hi = ImageEnhance.Sharpness(hi).enhance(1.25)
hi = ImageEnhance.Contrast(hi).enhance(1.06)
hi = ImageEnhance.Color(hi).enhance(1.05)

out_dir = ROOT / "frontend" / "assets" / "brand"
out_dir.mkdir(parents=True, exist_ok=True)
hi.save(out_dir / "login-bg@2x.png", quality=95)
hi.resize((1440, 900), Image.Resampling.LANCZOS).save(out_dir / "login-bg.png", quality=95)
print("wrote login-bg.png and login-bg@2x.png", hi.size)
