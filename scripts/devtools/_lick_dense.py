# -*- coding: utf-8 -*-
import cv2
import numpy as np
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/lick_dense"
os.makedirs(out, exist_ok=True)

cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# tight cat crop left-bottom
x0, y0, x1, y1 = int(w * 0.02), int(h * 0.48), int(w * 0.38), int(h * 0.98)

times = [round(float(t), 2) for t in np.arange(6.0, 10.36, 0.12)]
grays = {}
for t in times:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[y0:y1, x0:x1]
    vis = crop.copy()
    cv2.putText(vis, f"{t:.2f}", (6, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(out, f"t{str(t).replace('.', '_')}.png"), vis)
    grays[t] = cv2.cvtColor(cv2.resize(crop, (100, 80)), cv2.COLOR_BGR2GRAY)

# find best loop: A -> B where B-A in [1.2, 3.5], minimize |frameA-frameB|
pairs = []
ts = sorted(grays)
for i, ta in enumerate(ts):
    for tb in ts[i + 1 :]:
        period = tb - ta
        if period < 1.2 or period > 3.8:
            continue
        d = float(np.mean(cv2.absdiff(grays[ta], grays[tb])))
        pairs.append((d, ta, tb, period))
pairs.sort()
print("best lick loops:")
for row in pairs[:25]:
    print(f"diff={row[0]:.2f} {row[1]:.2f}->{row[2]:.2f} p={row[3]:.2f}")

# also motion on tight crop
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
prev = None
print("tight motion around 6-10:")
for i in range(n):
    ok, frame = cap.read()
    if not ok:
        break
    t = i / fps
    if t < 5.5:
        prev = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
        continue
    g = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    if prev is not None:
        d = float(np.mean(cv2.absdiff(prev, g)))
        if d > 1.2:
            print(f"{t:.3f}\t{d:.2f}")
    prev = g
cap.release()
