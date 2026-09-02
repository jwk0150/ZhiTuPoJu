# -*- coding: utf-8 -*-
import cv2
import os
import sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/look_loop"
os.makedirs(out, exist_ok=True)
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
x0, y0, x1, y1 = int(w * 0.05), int(h * 0.52), int(w * 0.42), int(h * 0.95)

times = [round(float(t), 2) for t in list(np.arange(6.3, 10.36, 0.15))]
grays = {}
for t in times:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[y0:y1, x0:x1]
    vis = crop.copy()
    cv2.putText(vis, f"{t:.2f}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(out, f"t{str(t).replace('.', '_')}.png"), vis)
    grays[t] = cv2.cvtColor(cv2.resize(crop, (100, 80)), cv2.COLOR_BGR2GRAY)

# seam: candidate ends near look-forward vs lick starts
print("dur", n / fps)
print("end->start seams (want look-end wrapping to lick-start):")
for start in [6.3, 6.45, 6.6, 6.75, 6.9]:
    if start not in grays:
        continue
    for end in [9.6, 9.75, 9.9, 10.05, 10.2, 10.3]:
        if end not in grays:
            continue
        d = float(np.mean(cv2.absdiff(grays[start], grays[end])))
        print(f"{start:.2f}<->{end:.2f} diff={d:.2f} len={end-start:.2f}")
cap.release()
