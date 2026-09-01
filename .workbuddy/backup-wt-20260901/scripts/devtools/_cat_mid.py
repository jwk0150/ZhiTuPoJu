# -*- coding: utf-8 -*-
import cv2
import numpy as np
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"frontend/assets/bg/scene3.mp4"
out = r"scripts/devtools/qa-screens/cat_mid"
os.makedirs(out, exist_ok=True)

cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# cat lands roughly mid-right of left half / center path
x0, y0, x1, y1 = int(w * 0.28), int(h * 0.42), int(w * 0.72), h

times = [round(t, 2) for t in list(np.arange(0.0, 2.2, 0.15)) + list(np.arange(2.5, 10.35, 0.25)) + [10.3]]
for t in times:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    crop = frame[y0:y1, x0:x1]
    # draw time
    vis = crop.copy()
    cv2.putText(vis, f"{t:.2f}s", (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(out, f"t{str(t).replace('.', '_')}.png"), vis)

# motion on this ROI
prev = None
diffs = []
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
for i in range(n):
    ok, frame = cap.read()
    if not ok:
        break
    g = cv2.GaussianBlur(cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY), (5, 5), 0)
    if prev is not None:
        diffs.append((i / fps, float(np.mean(cv2.absdiff(prev, g)))))
    prev = g

print("TOP:")
for t, d in sorted(diffs, key=lambda x: -x[1])[:20]:
    print(f"{t:.3f}\t{d:.2f}")
print("BUCKETS:")
t = 0
while t < n / fps:
    sl = [d for tt, d in diffs if t <= tt < t + 0.5]
    avg = sum(sl) / len(sl) if sl else 0
    mx = max(sl) if sl else 0
    print(f"{t:.1f}-{t+0.5:.1f} avg={avg:.2f} max={mx:.2f}")
    t += 0.5

# seam: end vs candidates
cap.set(cv2.CAP_PROP_POS_FRAMES, n - 2)
ok, lastf = cap.read()
last = cv2.cvtColor(cv2.resize(lastf[y0:y1, x0:x1], (160, 100)), cv2.COLOR_BGR2GRAY)
print("end seams:")
for t in np.arange(3.0, 10.0, 0.1):
    cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000)
    ok, f = cap.read()
    g = cv2.cvtColor(cv2.resize(f[y0:y1, x0:x1], (160, 100)), cv2.COLOR_BGR2GRAY)
    d = float(np.mean(cv2.absdiff(last, g)))
    if d < 3.2:
        print(f"{t:.1f} diff={d:.2f}")

# period pairs
start_f = int(3.0 * fps)
grays, times2 = [], []
cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
for i in range(start_f, n):
    ok, frame = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(cv2.resize(frame[y0:y1, x0:x1], (120, 80)), cv2.COLOR_BGR2GRAY)
    grays.append(g)
    times2.append(i / fps)
pairs = []
for i, ta in enumerate(times2):
    for j in range(i + int(1.5 * fps), min(len(times2), i + int(4.0 * fps))):
        tb = times2[j]
        d = float(np.mean(cv2.absdiff(grays[i], grays[j])))
        if d < 2.8:
            pairs.append((d, ta, tb, tb - ta))
pairs.sort()
print("best pairs:")
for row in pairs[:20]:
    print(f"diff={row[0]:.2f} {row[1]:.3f}->{row[2]:.3f} p={row[3]:.3f}")

cap.release()
print("saved", out)
