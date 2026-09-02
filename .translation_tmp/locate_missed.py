# -*- coding: utf-8 -*-
"""Locate missed French fragments with context."""
import re, io, html

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
data = open(XML, encoding="utf-8").read()

# Known true French fragments to find (normalized, accent-insensitive)
FRAGMENTS = [
    "Auteur correspondant",
    "Ici,",
    "entre en candidature.",
    "La contribution de transfert",
    "dans l\u2019ensemble des JD correspondant au poste",
    "Visualisation du graphe technologique des postes",
    "Par exemple :",
    "Des mappages d\u2019alias sont par exemple",
    "alors",
    "la confiance globale",
    "ne sert que d\u2019aide au classement et ne remplace pas directement",
    "L\u2019ensemble des orientations futures",
    "on enregistre sur les sources",
    "en enregistrant l\u2019augmentation relative",
    "Appariement poste-candidat et parcours d\u2019apprentissage",
    "et un profil de candidat",
    "on cherche une fonction de mappage",
    "telle que",
    "Appariement poste-candidat et parcours",
    "l\u2019ensemble des correspondances directes et",
    "s\u2019il existe une preuve de transfert avec une confiance de",
    "la contribution de transfert",
    "et le score de projet",
    "En cas de correspondance directe sans transfert",
    "Appariement en cinq dimensions",
    "Conclusion et perspectives",
    ") est",
    " et ",
]

out = io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\missed_locs.txt", "w", encoding="utf-8")
pattern = re.compile(r"<ns0:t(?: xml:space=\"preserve\")?>(.*?)</ns0:t>", re.S)
matches = list(pattern.finditer(data))
for i, m in enumerate(matches):
    plain = html.unescape(m.group(1))
    norm = plain.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"').replace("\xa0", " ")
    for frag in FRAGMENTS:
        fnorm = frag.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
        if fnorm.strip() and fnorm in norm:
            # print node index and surrounding text
            ctx_before = html.unescape(matches[i-1].group(1))[-60:] if i > 0 else ""
            ctx_after = html.unescape(matches[i+1].group(1))[:60] if i+1 < len(matches) else ""
            out.write("FRAG: %s\n  -> %s\n  CTX: [%s] << %s >> [%s]\n\n" % (frag[:50], plain.strip()[:120], ctx_before.strip(), plain.strip()[:120], ctx_after.strip()))
            break
out.close()
print("done")
