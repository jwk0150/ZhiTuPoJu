import gzip, json
f = gzip.open('exports/zhilian_roundtrip.jsonl.gz')
for i in range(5):
    line = f.readline()
    if not line:
        break
    obj = json.loads(line)
    ks = list(obj.keys())
    print(f'Line {i}: keys={ks}')
    for k, v in obj.items():
        if v is not None:
            v2 = str(v)[:80] if len(str(v)) > 80 else str(v)
            print(f'  {k}={v2}')
    print('---')
f.close()

# 统计总行数
f2 = gzip.open('exports/zhilian_roundtrip.jsonl.gz')
cnt = sum(1 for _ in f2)
f2.close()
print(f'\nTotal lines: {cnt}')
