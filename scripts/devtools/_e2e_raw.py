# -*- coding: utf-8 -*-
import json
import urllib.request
import urllib.parse

url = "http://127.0.0.1:5000/api/map/city-jobs/" + urllib.parse.quote("南昌")
print("URL:", url)
try:
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read().decode("utf-8")
        with open("_e2e_raw_out.txt", "w", encoding="utf-8") as f:
            f.write(data)
        print("OK, len:", len(data))
except Exception as e:
    print("ERR:", repr(e))
