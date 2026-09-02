# -*- coding: utf-8 -*-
"""Inspect 善泽生物 competition PDF design patterns."""
from pathlib import Path
import fitz

PDF = Path(r"N:\ppt素材\多份国赛获奖作品PPT\【国赛】善泽生物科技服务有限公司----：--.pdf")
OUT = Path(r"C:\Users\Ibiza\Desktop\project\挑战杯\scripts\devtools\design_doc\assets\shanze_preview")
OUT.mkdir(parents=True, exist_ok=True)

doc = fitz.open(str(PDF))
print("pages", doc.page_count)
print("metadata", doc.metadata)

# dump text of first 8 pages + a mid page
text_out = []
for i in list(range(min(8, doc.page_count))) + ([12, 20] if doc.page_count > 20 else []):
    if i >= doc.page_count:
        continue
    page = doc[i]
    text = page.get_text("text")
    text_out.append(f"===== PAGE {i+1} =====\n{text[:1800]}\n")
    # render preview
    pix = page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False)
    pix.save(str(OUT / f"page_{i+1:02d}.png"))
    print(f"page {i+1}: {page.rect.width:.0f}x{page.rect.height:.0f}, chars={len(text)}")

(OUT / "_text_dump.txt").write_text("\n".join(text_out), encoding="utf-8")
print("wrote", OUT)
