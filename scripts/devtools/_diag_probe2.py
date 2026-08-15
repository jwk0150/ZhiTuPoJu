import os
import sys

with open(r"d:/Learning_test/newtest/ZhiTuPoJu/_diag_probe2.txt", "w", encoding="utf-8") as f:
    f.write("cwd=" + os.getcwd() + "\n")
    f.write("python=" + sys.executable + "\n")
    try:
        import asyncpg
        f.write("asyncpg ok " + asyncpg.__version__ + "\n")
    except Exception as e:
        f.write("asyncpg fail: " + repr(e) + "\n")
    try:
        import backend.mappings
        f.write("backend.mappings ok\n")
    except Exception as e:
        f.write("backend.mappings fail: " + repr(e) + "\n")
