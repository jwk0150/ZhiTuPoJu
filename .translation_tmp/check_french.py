# -*- coding: utf-8 -*-
"""Check for remaining French text in document.xml."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

def has_french(s):
    if re.search(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]", s):
        return True
    return False

pattern = re.compile(r"<(ns0|ns9):t(?:\s[^>]*)?>(.*?)</\1:t>", re.S)
found = []
for m in pattern.finditer(data):
    plain = html.unescape(m.group(2))
    if has_french(plain):
        found.append(plain.strip()[:200])
print("french text nodes remaining:", len(found))
for f in found[:80]:
    print(" -", repr(f))
