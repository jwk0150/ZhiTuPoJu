# -*- coding: utf-8 -*-
"""Analyze scene3: jump early, lick loop near end (cat ends on RIGHT)."""
import cv2
import numpy as np
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/lick_right"
os.makedirs(out, exist_ok=True)

cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print("fps", fps, "frames", n, "dur", n / fps, "size", w, h)

# Right-side cat ROI after landing
rx0, ry0, rx1, ry1 = int(w * 0.55), int(h * 0.35), w, h
# Full bottom strip for motion profile
bx0, by0, bx1, by1 = 0, int(h * 0.40), w, h

prev = None
diffs = []
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
for i in range(n):
    ok, frame = cap.read()
    if not ok:
        break
    roi = frame[by0:by1, bx0:bx1]
    gray = cv2.GaussianBlur(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    if prev is not None:
        diffs.append((i / fps, float(np.mean(cv2.absdiff(prev, gray)))))
    prev = gray
print("TOP motion (full bottom):")
for t, d in sorted(diffs, key=lambda x: -x[1])[:25]:
    print(f"{t:.3f}\t{d:.2f}")

# Load right ROI frames from 1.5s onward
start_f = int(1.5 * fps)
grays = []
times = []
fulls = {}
cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
for i in range(start_f, n):
    ok, frame = cap.read()
    if not ok:
        break
    crop = frame[ry0:ry1, rx0:rx1]
    g = cv2.cvtColor(cv2.resize(crop, (120, 90)), cv2.COLOR_BGR2GRAY)
    grays.append(g)
    t = i / fps
    times.append(t)
    if abs(t * 20 - round(t * 20)) < 1e-6 or i == n - 1:  # ~0.05 steps for save later
        pass

# save visual samples on right ROI
save_times = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.3]
for t in save_times:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[ry0:ry1, rx0:rx1]
    cv2.imwrite(os.path.join(out, f"t{str(t).replace('.', '_')}.png"), crop)

cap.release()

last = grays[-1]
print("best seam start <-> end (right ROI):")
cands = []
for i, t in enumerate(times):
    remaining = times[-1] - t
    if remaining < 1.0 or remaining > 5.5:
        continue
    d = float(np.mean(cv2.absdiff(grays[i], last)))
    cands.append((d, t, remaining))
cands.sort()
for d, t, rem in cands[:20]:
    print(f"diff={d:.2f} start={t:.3f} len={rem:.3f}")

print("best closed pairs last 7s:")
pairs = []
t_min = times[-1] - 7.0
for i, ta in enumerate(times):
    if ta < t_min:
        continue
    for j in range(i + int(1.0 * fps), min(len(times), i + int(4.5 * fps))):
        tb = times[j]
        d = float(np.mean(cv2.absdiff(grays[i], grays[j])))
        if d < 5.5:
            pairs.append((d, ta, tb, tb - ta))
pairs.sort()
for d, ta, tb, p in pairs[:30]:
    print(f"diff={d:.2f} {ta:.3f}->{tb:.3f} period={p:.3f}")
