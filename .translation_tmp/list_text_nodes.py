# -*- coding: utf-8 -*-
"""List all w:t / m:t nodes with non-trivial text in document.xml."""
import re, io

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

# Find all text-bearing elements: ns0:t and ns9:t
pattern = re.compile(r"<(ns0|ns9):t( xml:space=\"preserve\")?>(.*?)</\1:t>", re.S)

def has_french(s):
    # detect latin accented or guillemets or french words
    if re.search(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]", s):
        return True
    return False

out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\text_nodes.txt", "w", encoding="utf-8")
idx = 0
for m in pattern.finditer(data):
    ns, sp, content = m.group(1), m.group(2), m.group(3)
    if not content:
        continue
    plain = content.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#x2019;", "'").replace("&#x201C;", '"').replace("&#x201D;", '"').replace("&#xA0;", " ").replace("&#x2264;", "<=").replace("&#x2265;", ">=").replace("&#x2248;", "~")
    if has_french(plain) or re.search(r"[一-鿿]", plain):
        out.write("NODE %d [%s] pos=%d\nTEXT: %s\n---\n" % (idx, ns, m.start(), plain[:4000]))
        idx += 1
out.close()
print("nodes:", idx)
