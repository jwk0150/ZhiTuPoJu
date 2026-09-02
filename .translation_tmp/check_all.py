# -*- coding: utf-8 -*-
"""Check for remaining CJK, verify key sections, and generate a full text dump."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

def has_cjk(s):
    return bool(re.search(r"[\u4e00-\u9fff]", s))

pattern = re.compile(r"<(ns0|ns9):t(?:\s[^>]*)?>(.*?)</\1:t>", re.S)
cjk = []
for m in pattern.finditer(data):
    plain = html.unescape(m.group(2))
    if has_cjk(plain):
        cjk.append(plain.strip()[:200])
print("CJK text nodes remaining:", len(cjk))
for c in cjk[:80]:
    print(" -", repr(c))

# dump full text for review
out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\final_text.txt", "w", encoding="utf-8")
# split into blocks
for m in re.finditer(r"<ns0:p(?:\s[^>]*)?>.*?</ns0:p>|<ns0:tbl>.*?</ns0:tbl>", data, re.S):
    blk = m.group(0)
    texts = re.findall(r"<(?:ns0|ns9):t(?:\s[^>]*)?>(.*?)</(?:ns0|ns9):t>", blk, re.S)
    s = html.unescape("".join(texts))
    if blk.startswith("<ns0:tbl"):
        out.write("[TABLE] " + s + "\n")
    else:
        if s.strip():
            out.write(s + "\n")
out.close()
print("final_text.txt written")
