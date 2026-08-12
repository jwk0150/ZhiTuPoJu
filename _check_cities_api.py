# -*- coding: utf-8 -*-
"""检查 /api/map/cities 对直辖市/港澳的返回"""
import urllib.request, urllib.parse, json, io, sys

def get(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:
        return {'err': str(e)}

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

for prov in ['北京', '上海', '天津', '重庆', '香港', '澳门', '河南', '广东', '江西']:
    enc = urllib.parse.quote(prov)
    d = get(f'http://127.0.0.1:5000/api/map/cities/{enc}')
    data = d.get('data') or []
    names = [x.get('name') for x in data] if isinstance(data, list) else data
    print(f"[{prov}] count={len(names)}: {names[:25]}")
