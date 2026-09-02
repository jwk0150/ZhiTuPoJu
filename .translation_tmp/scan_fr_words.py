# -*- coding: utf-8 -*-
"""Scan w:t nodes for French words without accents that were missed."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

# French function/connector words (accent-free) that betray French text
FR_WORDS = [
    r"\bet\b", r"\bde\b", r"\bdes\b", r"\bdu\b", r"\ble\b", r"\bla\b", r"\bles\b",
    r"\bun\b", r"\bune\b", r"\bdans\b", r"\bsur\b", r"\bpour\b", r"\bpar\b",
    r"\bavec\b", r"\bsans\b", r"\bentre\b", r"\best\b", r"\bsont\b", r"\balors\b",
    r"\bexemple\b", r"\bpostes?\b", r"\bcorrespondant\b", r"\bcandidature\b",
    r"\bcontribution\b", r"\bvisualisation\b", r"\bmappages?\b", r"\balias\b",
    r"\bainsi\b", r"\bdonc\b", r"\bcomme\b", r"\baux\b", r"\bau\b", r"\ben\b",
    r"\bce\b", r"\bcette\b", r"\bces\b", r"\bIci\b", r"\blequel\b", r"\bdont\b",
    r"\bpendant\b", r"\btel\b", r"\btelle\b", r"\bsi\b", r"\bou\b", r"\bparmi\b",
    r"\bchaque\b", r"\bailleurs\b", r"\btoutefois\b", r"\bcelle\b", r"\bcelui\b",
    r"\bet al\b", r"\bselon\b", r"\bconformément\b", r"\bposte\b", r"\bJD\b",
    r"\bsi\b", r"\bCette\b", r"\bLa\b", r"\ble\b", r"\ble\b", r"\bavec\b",
]
FR_RE = re.compile("|".join(FR_WORDS), re.I)

pattern = re.compile(r"<ns0:t(?: xml:space=\"preserve\")?>(.*?)</ns0:t>", re.S)

out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\missed_fr.txt", "w", encoding="utf-8")
hits = []
for m in pattern.finditer(data):
    plain = html.unescape(m.group(1))
    if not plain.strip():
        continue
    # skip pure numbers / formulas
    if re.fullmatch(r"[\d\s\.,;:%()=\+\-−÷×≤≥<>/|_^≈\u2211\u220f\u2202\u0394\u03b1-\u03c9\u2091-\u2093\u1d44\u02b3-]*", plain):
        continue
    if FR_RE.search(plain):
        hits.append(plain.strip()[:400])
        out.write(repr(plain.strip()[:400]) + "\n")
out.close()
print("missed french hits:", len(hits))
