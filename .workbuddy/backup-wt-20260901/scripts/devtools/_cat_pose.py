# -*- coding: utf-8 -*-
import cv2
import os
import sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/cat_pose"
os.makedirs(out, exist_ok=True)
cap = cv2.VideoCapture(path)
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
# tight on cat sitting area (left path)
x0, y0, x1, y1 = int(w * 0.05), int(h * 0.52), int(w * 0.42), int(h * 0.95)

for t in [round(x, 2) for x in np.arange(5.5, 10.35, 0.2)]:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[y0:y1, x0:x1]
    vis = crop.copy()
    cv2.putText(vis, f"{t:.2f}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(out, f"t{str(t).replace('.', '_')}.png"), vis)
cap.release()
print("done", out)
