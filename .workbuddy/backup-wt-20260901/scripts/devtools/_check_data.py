import gzip, json
f = gzip.open('exports/zhilian_roundtrip.jsonl.gz')
meta = None
postings = 0
details = 0
for line in f:
    obj = json.loads(line)
    if obj.get('_meta'):
        meta = obj
    elif obj.get('_table') == 'job_postings':
        postings += 1
    elif obj.get('_table') == 'job_posting_details':
        details += 1
f.close()
total_lines = 1 + postings + details
print(f"Total lines in backup: {total_lines}")
print(f"  _meta: 1")
print(f"  job_postings: {postings}")
print(f"  job_posting_details: {details}")
print(f"  = Actual job records: {postings}")
if meta:
    print(f"Backup metadata: db_count_pre={meta.get('db_count_pre')}")
