# -*- coding: utf-8 -*-
"""Compose A4 competition-style cover PNG for 执图破局 design plan.

全幅青绿金波纹背景 + 半透明内容卡（补全左右装饰，避免中间挖空感）。
"""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
OUT = ASSETS / "cover-composed.png"

# A4 @ 150 dpi
W, H = 1240, 1754

SHANZE_PDF = Path(
    r"N:\ppt素材\多份国赛获奖作品PPT\【国赛】善泽生物科技服务有限公司----：--.pdf"
)


def font(path_candidates, size):
    for p in path_candidates:
        fp = Path(p)
        if fp.exists():
            try:
                return ImageFont.truetype(str(fp), size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def _soft_place(canvas: Image.Image, img: Image.Image, xy: tuple[int, int], opacity: float = 0.5):
    im = img.copy()
    a = im.split()[-1].point(lambda v: int(v * opacity))
    im.putalpha(a)
    canvas.alpha_composite(im, xy)


def _side_mesh() -> Image.Image | None:
    try:
        import fitz
    except Exception:
        return None
    if not SHANZE_PDF.exists():
        return None
    d = fitz.open(str(SHANZE_PDF))
    pix = d[1].get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
    mesh_src = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")
    mw0, mh0 = mesh_src.size
    mesh = mesh_src.crop((int(mw0 * 0.55), 0, mw0, int(mh0 * 0.22)))
    px = mesh.load()
    mw, mh = mesh.size
    for y in range(mh):
        for x in range(mw):
            r, g, b, a = px[x, y]
            if r > 248 and g > 248 and b > 248:
                px[x, y] = (255, 255, 255, 0)
                continue
            darkness = 255 - (r + g + b) / 3
            if darkness < 2:
                px[x, y] = (255, 255, 255, 0)
                continue
            t = min(1.0, darkness / 30)
            px[x, y] = (int(40 * t), int(160 * t), int(185 * t), int(90 * t))
    return mesh


def main():
    bg = Image.open(ASSETS / "cover-bg.png").convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    canvas.alpha_composite(bg)

    # 左右补全装饰，消除「只有上下有背景」的挖空感
    mesh = _side_mesh()
    if mesh is not None:
        side = mesh.resize((420, 280), Image.Resampling.LANCZOS)
        side_l = side.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        _soft_place(canvas, side_l, (-40, 520), 0.35)
        _soft_place(canvas, side, (W - 380, 480), 0.4)
        _soft_place(canvas, side_l.resize((360, 240)), (-20, 900), 0.25)
        _soft_place(canvas, side.resize((360, 240)), (W - 340, 860), 0.28)

    # 半透明内容卡（透出周边波纹，不再整块挖白）
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((70, 200, W - 70, 1320), radius=32, fill=(255, 255, 255, 188))
    panel = panel.filter(ImageFilter.GaussianBlur(0.8))
    canvas.alpha_composite(panel)

    draw = ImageDraw.Draw(canvas)
    yahei = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc"]
    heiti = [r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\msyhbd.ttc"]
    f_en = font(yahei, 32)
    f_brand = font(heiti, 96)
    f_title = font(heiti, 38)
    f_sub = font(heiti, 34)
    f_meta = font(yahei, 26)
    f_doc = font(heiti, 28)
    f_foot = font(heiti, 26)

    logo = Image.open(ASSETS / "logo.png").convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, ((W - 128) // 2, 260))

    def center(text, y, fnt, fill):
        b = draw.textbbox((0, 0), text, font=fnt)
        draw.text(((W - (b[2] - b[0])) / 2, y), text, font=fnt, fill=fill)

    center("作品设计实现方案", 410, f_doc, (36, 88, 96, 255))
    center("The future is mapped", 455, f_en, (90, 125, 135, 255))

    brand = "执图破局"
    tracking = 20
    widths = []
    for c in brand:
        b = draw.textbbox((0, 0), c, font=f_brand)
        widths.append(b[2] - b[0])
    total = sum(widths) + tracking * (len(brand) - 1)
    x = (W - total) / 2
    for ch, w in zip(brand, widths):
        draw.text((x, 520), ch, font=f_brand, fill=(18, 48, 56, 255))
        x += w + tracking

    draw.rounded_rectangle((W // 2 - 100, 640, W // 2 + 100, 646), radius=3, fill=(201, 168, 106, 255))
    center("让人才与机会更精准连接", 670, f_sub, (40, 78, 86, 255))
    center("多源异构数据驱动的岗位—能力知识图谱", 760, f_title, (28, 52, 58, 255))
    center("动态构建与智能匹配系统", 815, f_title, (28, 52, 58, 255))

    meta = [
        "赛题编号：XH-202621",
        "发榜单位：科大讯飞",
        "赛事名称：2026 中国青年「揭榜挂帅」擂台赛",
        "申报单位：河南工业大学 · 人工智能与大数据学院",
        "团队成员：傅英淮、李帅 等",
        "文档类型：平台设计方案（提交版）",
    ]
    my = 960
    for line in meta:
        center(line, my, f_meta, (55, 78, 86, 255))
        my += 40

    # 底部白字 + 轻阴影，保证在青绿波纹上清晰
    foot = "执图破局 平台设计方案"
    b = draw.textbbox((0, 0), foot, font=f_foot)
    fx = (W - (b[2] - b[0])) / 2
    fy = 1580
    draw.text((fx + 1, fy + 1), foot, font=f_foot, fill=(10, 40, 50, 160))
    draw.text((fx, fy), foot, font=f_foot, fill=(255, 255, 255, 255))

    rgb = ImageEnhance.Color(canvas.convert("RGB")).enhance(1.08)
    rgb.save(OUT, "PNG", quality=95)
    print("wrote", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
