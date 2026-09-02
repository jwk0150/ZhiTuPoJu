# -*- coding: utf-8 -*-
import re, html
XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()
# only text content inside t nodes, not attributes
pattern = re.compile(r"<ns0:t(?: xml:space=\"preserve\")?>(.*?)</ns0:t>", re.S)
hits = []
for m in pattern.finditer(data):
    plain = html.unescape(m.group(1))
    if re.search(r"[\u4e00-\u9fff]", plain):
        hits.append(plain.strip()[:300])
print("real CJK in w:t:", len(hits))
for h in hits:
    print(" -", repr(h))
