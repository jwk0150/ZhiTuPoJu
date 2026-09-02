# -*- coding: utf-8 -*-
"""Final comprehensive scan: all XML files, all text-bearing elements, French check."""
import zipfile, re, io, html

DOCX = r"d:\Learning_test\backup3\ZhiTuPoJu\论文(2)_EN.docx"
z = zipfile.ZipFile(DOCX)
ACC = re.compile(r"[àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ]")

for n in z.namelist():
    if not (n.endswith(".xml") or n.endswith(".rels")):
        continue
    data = z.read(n).decode("utf-8", errors="replace")
    # strip tags but keep text content
    txt = re.sub(r"<[^>]+>", " ", data)
    txt = html.unescape(txt)
    # ignore known formula variables
    txt2 = re.sub(r"Vposte|Vcomp\u00e9tences|Vsecteurs|Ventreprises|Dposte|n\(poste", " ", txt)
    hits = []
    for m in ACC.finditer(txt2):
        s = max(0, m.start()-40)
        e = min(len(txt2), m.end()+40)
        frag = txt2[s:e].replace("\n", " ")
        hits.append(frag)
    if hits:
        print("=== %s : %d hits" % (n, len(hits)))
        for h in hits[:6]:
            print("   ", h.strip()[:100])
print("scan done")
