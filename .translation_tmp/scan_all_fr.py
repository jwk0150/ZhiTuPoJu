# -*- coding: utf-8 -*-
"""Comprehensive final scan: any node containing French words (accented or not)."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

ACCENT_RE = re.compile(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]")
# French words that appear accent-free
FR_WORDS = re.compile(
    r"\b(?:et\b|ou\b|des\b|du\b|de\b|les?\b|une?\b|dans\b|sur\b|pour\b|par\b|avec\b|"
    r"sans\b|entre\b|est\b|sont\b|alors\b|exemple\b|postes?\b|correspondant\b|candidature\b|"
    r"contribution\b|visualisation\b|mappages?\b|alias\b|ainsi\b|donc\b|comme\b|aux\b|au\b|en\b|"
    r"ce\b|cette\b|ces\b|Ici\b|auquel\b|dont\b|pendant\b|tels?\b|parmi\b|chaque\b|ailleurs\b|"
    r"toutefois\b|selon\b|celles?\b|celui\b|si\b|la\b|le\b|avec\b|fonction\b|mappage\b|"
    r"prouve\b|augmentation\b|relative\b|sources\b|orientations\b|futures\b|ajout\b|suppression\b|"
    r"candidat\b|profil\b|apprentissage\b|appariement\b|dimensions?\b|conclusion\b|perspectives\b|"
    r"transfert\b|confiance\b|globale\b|ensemble\b)", re.I)

pattern = re.compile(r"<ns0:t( xml:space=\"preserve\")?>(.*?)</ns0:t>", re.S)
hits = []
for m in pattern.finditer(data):
    plain = html.unescape(m.group(2))
    if not plain.strip():
        continue
    if ACCENT_RE.search(plain) or FR_WORDS.search(plain):
        hits.append(plain.strip()[:250])

out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\scan_all_out.txt", "w", encoding="utf-8")
for h in hits:
    out.write(h + "\n")
out.close()
print("candidate hits:", len(hits))
