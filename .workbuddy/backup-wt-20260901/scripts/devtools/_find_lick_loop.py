# -*- coding: utf-8 -*-
import cv2
import numpy as np
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/lick2"
os.makedirs(out, exist_ok=True)

cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

times = list(np.arange(0.0, 2.2, 0.1)) + list(np.arange(6.5, 10.35, 0.15)) + [10.3]
times = sorted(set(round(float(t), 2) for t in times))

x0, y0, x1, y1 = 0, int(h * 0.38), int(w * 0.38), h
frames = {}
for t in times:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[y0:y1, x0:x1]
    fn = os.path.join(out, f"t{str(t).replace('.', '_')}.png")
    cv2.imwrite(fn, crop)
    gray = cv2.cvtColor(cv2.resize(crop, (160, 120)), cv2.COLOR_BGR2GRAY)
    frames[t] = gray
cap.release()
print("saved", len(frames), "to", out)

last_t = max(frames)
last = frames[last_t]
print("similarity to end frame t=", last_t)
sims = []
for t, g in frames.items():
    if t < 5:
        continue
    d = float(np.mean(cv2.absdiff(last, g)))
    sims.append((t, d))
sims.sort(key=lambda x: x[1])
for t, d in sims[:15]:
    print(f"{t:.2f}\tdiff={d:.2f}")

print("--- pairwise near end ---")
cands = [7.0, 7.3, 7.6, 7.9, 8.2, 8.5, 8.8, 9.1, 9.4, 9.7, 10.0, 10.3]
for a in cands:
    if a not in frames:
        continue
    for b in cands:
        if b <= a or b not in frames:
            continue
        d = float(np.mean(cv2.absdiff(frames[a], frames[b])))
        if d < 4.5:
            print(f"{a:.2f}<->{b:.2f} diff={d:.2f} period={b - a:.2f}")
