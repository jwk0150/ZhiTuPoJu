import os, shutil

BASE = r"C:\Users\Dsy\ZhiTuPoJu"
BAK = r"C:\Users\Dsy\ZhiTuPoJu\.workbuddy\backup-wt-20260901"
DEST = r"C:\Users\Dsy\ZhiTuPoJu\.workbuddy\backup-wt-20260901\extra-from-main-HEAD"
ROOTS = ["backend", "frontend", "scripts", "docs", "crawler"]

moved = []


def walk(cur_dir, bak_dir, rel):
    try:
        entries = os.listdir(cur_dir)
    except FileNotFoundError:
        return
    for name in entries:
        cur = os.path.join(cur_dir, name)
        bak = os.path.join(bak_dir, name)
        r = os.path.join(rel, name) if rel else name
        if not os.path.exists(bak):
            target = os.path.join(DEST, r)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.move(cur, target)
            moved.append(r)
        elif os.path.isdir(cur) and os.path.isdir(bak):
            walk(cur, bak, r)


for root in ROOTS:
    cur_root = os.path.join(BASE, root)
    bak_root = os.path.join(BAK, root)
    walk(cur_root, bak_root, root)

print("moved %d extra entries" % len(moved))
for m in moved[:60]:
    print("  -", m)
