import hashlib, os
m = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\unpacked2\word\media"
f = r"d:\Learning_test\backup3\ZhiTuPoJu\.translation_tmp\fr_images"
def h(p): return hashlib.md5(open(p,'rb').read()).hexdigest()[:10]
print("media:")
for n in sorted(os.listdir(m)): print(" ", n, os.path.getsize(os.path.join(m,n)), h(os.path.join(m,n)))
print("fr_images:")
for n in sorted(os.listdir(f)): print(" ", n, os.path.getsize(os.path.join(f,n)), h(os.path.join(f,n)))
