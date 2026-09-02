# -*- coding: utf-8 -*-
"""Apply fragment translations with stripped-key lookup."""
import re, io, html, sys

sys.path.insert(0, r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp")
from trans_d import FRAG_TRANS
from trans_d2 import FRAG_TRANS2
FRAG = {k.strip(): v for k, v in list(FRAG_TRANS.items()) + list(FRAG_TRANS2.items())}

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

def norm(s):
    return s.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"').replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")

def escape_xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

pattern = re.compile(r"<ns0:t( xml:space=\"preserve\")?>(.*?)</ns0:t>", re.S)
matches = []
counts = {}
for m in pattern.finditer(data):
    sp, content = m.group(1) or "", m.group(2)
    plain = html.unescape(content)
    n = norm(plain)
    key = n.strip()
    if key in FRAG:
        new_text = FRAG[key]
    elif re.fullmatch(r"et", key):
        new_text = "and"
    else:
        continue
    lead = n[:len(n) - len(n.lstrip())]
    trail = n[len(n.rstrip()):]
    new_text = lead + new_text + trail
    new_esc = escape_xml(new_text)
    keep_space = ' xml:space="preserve"' if (sp or (new_text[:1] in " \t" or new_text[-1:] in " \t")) else ""
    repl = "<ns0:t%s>%s</ns0:t>" % (keep_space, new_esc)
    matches.append((m.start(), m.end(), repl))
    counts[key] = counts.get(key, 0) + 1

print("fragments replaced:", len(matches))
for k, v in counts.items():
    print("  %d x %r" % (v, k[:70]))

out = data
for start, end, repl in reversed(matches):
    out = out[:start] + repl + out[end:]
open(XML, "w", encoding="utf-8").write(out)
print("done")
