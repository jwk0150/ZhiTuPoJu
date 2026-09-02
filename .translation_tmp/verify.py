# -*- coding: utf-8 -*-
"""Verify the output docx: valid XML, English content, images updated."""
import zipfile, re, io, html

DOCX = r"d:\Learning_test\backup3\ZhiTuPoJu\论文(2)_EN.docx"
z = zipfile.ZipFile(DOCX)
names = z.namelist()

# 1. XML validity of document.xml
doc = z.read("word/document.xml").decode("utf-8")
try:
    import xml.etree.ElementTree as ET
    ET.fromstring(doc)
    print("document.xml: valid XML")
except Exception as e:
    print("document.xml INVALID:", e)

# 2. French accent check in document.xml
ACC = re.compile(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]")
fr = []
for m in re.finditer(r"<(?:ns0|ns9):t(?:\s[^>]*)?>(.*?)</(?:ns0|ns9):t>", doc, re.S):
    t = html.unescape(m.group(1))
    if ACC.search(t) and not re.fullmatch(r"[\d\s.,;:()%=\+\-−÷×≤≥<>/|_^]*", t):
        # ignore formula variables (poste, compétences etc.) - show for manual review
        fr.append(t.strip()[:100])
print("accented text nodes:", len(fr))
for f in fr[:30]:
    print("  -", repr(f))

# 3. Chinese check
cjk = []
for m in re.finditer(r"<ns0:t(?: xml:space=\"preserve\")?>(.*?)</ns0:t>", doc, re.S):
    t = html.unescape(m.group(1))
    if re.search(r"[\u4e00-\u9fff]", t):
        cjk.append(t.strip()[:80])
print("CJK text nodes:", len(cjk))
for c in cjk[:10]:
    print("  -", repr(c))

# 4. Images in package
media = sorted(n for n in names if n.startswith("word/media/"))
print("media files:", len(media))
for n in media:
    print("  ", n, z.getinfo(n).file_size)

# 5. content types / rels present
for n in names:
    if n in ("[Content_Types].xml", "word/_rels/document.xml.rels"):
        print("present:", n)
