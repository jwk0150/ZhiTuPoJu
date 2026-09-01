# -*- coding: utf-8 -*-
from docx import Document
from docx.oxml.ns import qn
from pathlib import Path
from lxml import etree

path = Path(r"C:\Users\Ibiza\Desktop\lunwen - 副本.docx")
out = Path(r"C:\Users\Ibiza\Desktop\project\挑战杯\scripts\devtools\_lunwen_inspect.txt")
doc = Document(str(path))
lines = []


def has_math(p):
    xml = p._element.xml
    return "oMath" in xml


def has_drawing(p):
    xml = p._element.xml
    return "w:drawing" in xml or "w:pict" in xml


for i, p in enumerate(doc.paragraphs):
    flags = []
    if has_math(p):
        flags.append("MATH")
    if has_drawing(p):
        flags.append("DRAW")
    style = p.style.name if p.style else ""
    if "Heading" in style or flags or (12 <= i <= 45):
        east = None
        if p.runs:
            rPr = p.runs[0]._element.find(qn("w:rPr"))
            if rPr is not None:
                rf = rPr.find(qn("w:rFonts"))
                if rf is not None:
                    east = rf.get(qn("w:eastAsia"))
        lines.append(
            f"{i:04d} [{style}] {'|'.join(flags)} east={east} text={p.text.strip()[:90]!r}"
        )

h2 = doc.styles["Heading 2"]
lines.append(f"H2 font={h2.font.name} size={h2.font.size} bold={h2.font.bold}")
rPr = h2.element.find(qn("w:rPr"))
if rPr is not None:
    lines.append(etree.tostring(rPr, encoding="unicode")[:800])

out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", len(lines))
