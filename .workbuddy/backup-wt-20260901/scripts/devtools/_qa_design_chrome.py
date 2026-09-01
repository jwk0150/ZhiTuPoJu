# -*- coding: utf-8 -*-
from pathlib import Path
import time
import win32com.client
import fitz
from PIL import Image
from docx import Document

ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / "作品设计实现方案_提交版.docx"
PDF = ROOT / "scripts/devtools/design_doc/assets/visual_preview.pdf"
OUT = ROOT / "scripts/devtools/design_doc/assets/visual_pages"

d = Document(str(DOCX))
print("chars", sum(len(t.text) for t in d.paragraphs))
sec = d.sections[1]
xml = sec.header._element.xml
print("has_inline", "wp:inline" in xml)
print("banner_in_header", "image" in xml.lower() or "blip" in xml)

word = win32com.client.Dispatch("Word.Application")
word.Visible = False
doc = word.Documents.Open(str(DOCX))
doc.SaveAs(str(PDF), FileFormat=17)
doc.Close(False)
word.Quit()
time.sleep(0.4)

z = fitz.open(str(PDF))
print("pages", z.page_count)
OUT.mkdir(parents=True, exist_ok=True)
for i in [1, 4, 8]:
    pix = z[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = OUT / f"qa5_p{i + 1:02d}.png"
    pix.save(str(path))
    im = Image.open(path)
    w, h = im.size
    im.crop((0, 0, w, int(h * 0.18))).save(OUT / f"qa5_hdr_{i + 1:02d}.png")
    print("saved", path.name)
