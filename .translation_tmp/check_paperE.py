# -*- coding: utf-8 -*-
import os, docx

p = os.path.join(r"d:\Learning_test\backup3\ZhiTuPoJu", "\u8bba\u6587E.docx")
d = docx.Document(p)
paras = [t.text for t in d.paragraphs if t.text.strip()]
print("file:", os.path.basename(p), os.path.getsize(p))
print("paragraphs:", len(paras), "| tables:", len(d.tables))
print("first:", paras[0][:70])
print("Related Works:", any("Related Works" in t for t in paras))
print("Conclusion:", any("Conclusion and Perspectives" in t for t in paras))
