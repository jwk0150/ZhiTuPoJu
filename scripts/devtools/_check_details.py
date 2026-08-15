import gzip, json

details_sample = None
f = gzip.open('exports/zhilian_roundtrip.jsonl.gz')
for line in f:
    obj = json.loads(line)
    if obj.get('_table') == 'job_posting_details':
        details_sample = obj
        break
f.close()

if details_sample:
    ks = list(details_sample.keys())
    print(f'details keys ({len(ks)}):')
    for k in ks:
        v = details_sample[k]
        vt = type(v).__name__
        if v is not None:
            vs = str(v)[:80] if len(str(v)) > 80 else str(v)
            print(f'  {k}: {vt} = {vs}')
        else:
            print(f'  {k}: {vt} = None')
else:
    print('No details found')
