# -*- coding: utf-8 -*-
"""Apply translations to document.xml in node order."""
import re, io, sys, html

sys.path.insert(0, r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp")
from trans_a import TRANS_A
from trans_b import TRANS_B
from trans_c import TRANS_C
TRANS = TRANS_A + TRANS_B + TRANS_C
print("total translations:", len(TRANS))

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

def has_french(s):
    if re.search(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]", s):
        return True
    return False

pattern = re.compile(r"<(ns0|ns9):t( xml:space=\"preserve\")?>(.*?)</\1:t>", re.S)

def escape_xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# collect all matches first (start, end, ns, sp, content)
matches = []
idx = 0
for m in pattern.finditer(data):
    ns, sp, content = m.group(1), m.group(2) or "", m.group(3)
    plain = html.unescape(content)
    plain = plain.replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")
    if not plain.strip():
        continue
    if has_french(plain) or re.search(r"[一-鿿]", plain):
        if idx >= len(TRANS):
            print("WARN: no translation for node", idx, repr(plain[:80]))
            idx += 1
            continue
        new_text = TRANS[idx]
        idx += 1
        # build replacement preserving tag
        new_esc = escape_xml(new_text)
        # decide whether xml:space needed
        keep_space = ' xml:space="preserve"' if (sp or (new_text[:1] in " \t" or new_text[-1:] in " \t")) else ""
        repl = "<%s:t%s>%s</%s:t>" % (ns, keep_space, new_esc, ns)
        matches.append((m.start(), m.end(), repl))

print("nodes replaced:", len(matches))

# apply from end to start
out = data
for start, end, repl in reversed(matches):
    out = out[:start] + repl + out[end:]

open(XML, "w", encoding="utf-8").write(out)
print("done")
