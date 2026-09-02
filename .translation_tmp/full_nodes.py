# -*- coding: utf-8 -*-
"""Extract every text node's full decoded text, in order, to a file."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
OUT = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\full_nodes.txt"
data = open(XML, encoding="utf-8").read()

pattern = re.compile(r"<(ns0|ns9):t( xml:space=\"preserve\")?>(.*?)</\1:t>", re.S)

def has_french(s):
    if re.search(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]", s):
        return True
    return False

out = io.open(OUT, "w", encoding="utf-8")
idx = 0
for m in pattern.finditer(data):
    ns, sp, content = m.group(1), m.group(2), m.group(3)
    plain = html.unescape(content)
    plain = plain.replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")
    if not plain.strip():
        continue
    if has_french(plain) or re.search(r"[一-鿿]", plain):
        out.write("### NODE %d [%s] len=%d\n" % (idx, ns, len(plain)))
        out.write(plain + "\n\n")
        idx += 1
out.close()
print("nodes:", idx)
