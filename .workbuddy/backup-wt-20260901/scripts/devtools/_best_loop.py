# -*- coding: utf-8 -*-
"""Find best A-B loop window near end of scene3 (cat ROI)."""
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
x0, y0, x1, y1 = 0, int(h * 0.40), int(w * 0.36), h

# load all frames from 4s onward at full fps into tiny gray
start_f = int(4.0 * fps)
grays = []
times = []
cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
for i in range(start_f, n):
    ok, frame = cap.read()
    if not ok:
        break
    crop = frame[y0:y1, x0:x1]
    g = cv2.cvtColor(cv2.resize(crop, (96, 72)), cv2.COLOR_BGR2GRAY)
    grays.append(g)
    times.append(i / fps)
cap.release()
print("samples", len(grays), "from", times[0], "to", times[-1])

# For each candidate loop start index, compare start frame to last frame
# Prefer windows of 1.5s .. 4.5s near the end
best = []
last = grays[-1]
for i, t in enumerate(times):
    remaining = times[-1] - t
    if remaining < 1.2 or remaining > 5.0:
        continue
    d = float(np.mean(cv2.absdiff(grays[i], last)))
    best.append((d, t, times[-1], remaining))

best.sort(key=lambda x: x[0])
print("best seam (start <-> end):")
for row in best[:20]:
    print(f"diff={row[0]:.2f} start={row[1]:.3f} end={row[2]:.3f} len={row[3]:.3f}")

# Also search any A-B pairs with period ~1.5-3.5s in last 6s
print("best closed pairs in last 6s:")
pairs = []
t0 = times[-1] - 6.0
for i, ta in enumerate(times):
    if ta < t0:
        continue
    for j in range(i + int(1.2 * fps), min(len(times), i + int(3.8 * fps))):
        tb = times[j]
        d = float(np.mean(cv2.absdiff(grays[i], grays[j])))
        if d < 6.0:
            pairs.append((d, ta, tb, tb - ta))
pairs.sort(key=lambda x: x[0])
for row in pairs[:25]:
    print(f"diff={row[0]:.2f} {row[1]:.3f}->{row[2]:.3f} period={row[3]:.3f}")
