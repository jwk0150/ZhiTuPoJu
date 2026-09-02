import os
from PIL import Image
d = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media"
for n in sorted(os.listdir(d)):
    p = os.path.join(d, n)
    try:
        im = Image.open(p)
        print(n, im.size, im.mode)
    except Exception as e:
        print(n, "ERR", e)
