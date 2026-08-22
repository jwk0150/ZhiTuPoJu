# -*- coding: utf-8 -*-
import cv2
import numpy as np
import sys

sys.stdout.reconfigure(encoding="utf-8")
path = r"frontend/assets/bg/scene3.mp4"
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
x0, y0, x1, y1 = int(w * 0.05), int(h * 0.50), int(w * 0.45), int(h * 0.96)

# load frames 6.2 .. end
start_f = int(6.2 * fps)
grays, times = [], []
cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
for i in range(start_f, n):
    ok, frame = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(cv2.resize(frame[y0:y1, x0:x1], (120, 90)), cv2.COLOR_BGR2GRAY)
    grays.append(g)
    times.append(i / fps)
cap.release()

# Prefer loops that include look (>=9.5) and start in lick (<=7.2)
cands = []
for i, ta in enumerate(times):
    if ta < 6.35 or ta > 7.4:
        continue
    for j in range(i + int(2.2 * fps), len(times)):
        tb = times[j]
        if tb < 9.45:
            continue
        d = float(np.mean(cv2.absdiff(grays[i], grays[j])))
        # score: lower diff better; prefer longer look (higher tb) slightly
        score = d - (tb - 9.5) * 0.15
        cands.append((score, d, ta, tb, tb - ta))
cands.sort()
print("best seamless loops (lick start -> look end):")
for row in cands[:20]:
    print(f"score={row[0]:.2f} diff={row[1]:.2f} {row[2]:.3f}->{row[3]:.3f} len={row[4]:.3f}")
