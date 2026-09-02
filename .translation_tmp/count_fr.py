# -*- coding: utf-8 -*-
"""Count French-text OCR blocks per image."""
import json, io, re, unicodedata

data = json.load(io.open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_data.json", encoding="utf-8"))

ACCENT = re.compile(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]")
FR_WORDS = re.compile(
    r"\b(?:et\b|ou\b|des\b|du\b|de\b|les?\b|une?\b|dans\b|sur\b|pour\b|par\b|avec\b|"
    r"sans\b|entre\b|est\b|sont\b|alors\b|exemple\b|postes?\b|correspondant\b|candidature\b|"
    r"contribution\b|visualisation\b|mappages?\b|alias\b|ainsi\b|donc\b|comme\b|aux\b|au\b|en\b|"
    r"ce\b|cette\b|ces\b|Ici\b|auquel\b|dont\b|pendant\b|tels?\b|parmi\b|chaque\b|ailleurs\b|"
    r"toutefois\b|selon\b|celles?\b|celui\b|si\b|la\b|le\b|avec\b|fonction\b|mappage\b|"
    r"prouve\b|augmentation\b|relative\b|sources\b|orientations\b|futures\b|ajout\b|suppression\b|"
    r"candidat\b|profil\b|apprentissage\b|appariement\b|dimensions?\b|conclusion\b|perspectives\b|"
    r"transfert\b|confiance\b|globale\b|ensemble\b|niveau\b|poste\b|salaire\b|ville\b|compétences?\b|"
    r"technique\b|développement\b|logiciel\b|données?\b|analyse\b|compétence\b|échantillon\b)", re.I)

for img, blocks in data.items():
    fr = [b for b in blocks if ACCENT.search(b["text"]) or FR_WORDS.search(b["text"])]
    print("%s: %d/%d french-ish" % (img, len(fr), len(blocks)))
