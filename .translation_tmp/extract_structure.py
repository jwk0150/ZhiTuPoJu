# -*- coding: utf-8 -*-
"""Extract paragraph structure from document.xml with text content."""
import re, io

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\structure.txt"

data = open(XML, encoding="utf-8").read()

def find_blocks(xml):
    out = []
    for m in re.finditer(r"<ns0:p(?:\s[^>]*)?>.*?</ns0:p>|<ns0:tbl>.*?</ns0:tbl>|<ns0:sectPr>.*?</ns0:sectPr>", xml, re.S):
        blk = m.group(0)
        if blk.startswith("<ns0:p"):
            kind = "P"
        elif blk.startswith("<ns0:tbl"):
            kind = "TBL"
        else:
            kind = "SECT"
        out.append((kind, m.start(), m.end(), blk))
    return out

blocks = find_blocks(data)
print("total blocks:", len(blocks))

def get_text(xml):
    # w:t plus m:t (math) — but we want to see raw layout, so include both
    texts = re.findall(r"<(?:ns0|ns9):t(?:\s[^>]*)?>(.*?)</(?:ns0|ns9):t>", xml, re.S)
    s = "".join(texts)
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#x2019;", "'").replace("&#x201C;", '"').replace("&#x201D;", '"')

def get_style(xml):
    m = re.search(r'<ns0:pStyle ns0:val="([^"]+)"', xml)
    return m.group(1) if m else ""

out = io.open(OUT, "w", encoding="utf-8")
for kind, start, end, blk in blocks:
    if kind == "SECT":
        out.write("===== SECT PR =====\n")
        continue
    if kind == "P":
        text = get_text(blk)
        style = get_style(blk)
        has_img = "<ns0:drawing>" in blk or "<ns0:pict>" in blk
        tag = "IMG" if has_img else "P"
        out.write("[%s] style=%s | %s\n" % (tag, style, text[:6000]))
    else:
        out.write("===== TABLE BLOCK =====\n")
        rows = re.findall(r"<ns0:tr[ >].*?</ns0:tr>", blk, re.S)
        for r in rows:
            cells = re.findall(r"<ns0:tc[ >].*?</ns0:tc>", r, re.S)
            cell_texts = []
            for c in cells:
                ct = get_text(c)
                cell_texts.append(ct.replace("\n", " "))
            out.write("  | " + " || ".join(cell_texts) + "\n")
        out.write("===== END TABLE =====\n")
out.close()
print("done ->", OUT)
