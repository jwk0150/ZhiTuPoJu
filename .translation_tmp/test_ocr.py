# -*- coding: utf-8 -*-
from rapidocr_onnxruntime import RapidOCR
import json

engine = RapidOCR()
img = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media\image8.png"
result, elapse = engine(img)
out = []
if result:
    for line in result:
        box, text, score = line[0], line[1], line[2]
        out.append({"box": box, "text": text, "score": float(score)})
with open(r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\ocr_image8.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("detected:", len(out))
for o in out[:20]:
    print(o["text"], o["score"])
