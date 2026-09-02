# -*- coding: utf-8 -*-
"""Split document.xml into individual blocks (p / tbl / sectPr) and save each to a file."""
import re, io, os, json

XML = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\document.xml"
OUTDIR = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\blocks"

data = open(XML, encoding="utf-8").read()
os.makedirs(OUTDIR, exist_ok=True)

def find_blocks(xml):
    out = []
    for m in re.finditer(r"<ns0:p(?:\s[^>]*)?>.*?</ns0:p>|<ns0:tbl>.*?</ns0:tbl>|<ns0:sectPr>.*?</ns0:sectPr>", xml, re.S):
        blk = m.group(0)
        if blk.startswith("<ns0:p"):
            kind = "P"
        elif blk.startswith("<ns0:tbl"):
            kind = "TBL"
        else:
            kind = "SECT"
        out.append((kind, m.start(), m.end(), blk))
    return out

blocks = find_blocks(data)
print("total blocks:", len(blocks))

def get_all_text(xml):
    texts = re.findall(r"<(?:ns0|ns9):t(?:\s[^>]*)?>(.*?)</(?:ns0|ns9):t>", xml, re.S)
    s = "".join(texts)
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#x2019;", "'").replace("&#x201C;", '"').replace("&#x201D;", '"')

manifest = []
for i, (kind, start, end, blk) in enumerate(blocks):
    fn = os.path.join(OUTDIR, "block_%03d_%s.xml" % (i, kind))
    with io.open(fn, "w", encoding="utf-8") as f:
        f.write(blk)
    manifest.append({
        "idx": i, "kind": kind, "start": start, "end": end,
        "text": get_all_text(blk)[:300]
    })

with io.open(os.path.join(OUTDIR, "_manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print("blocks written to", OUTDIR)
