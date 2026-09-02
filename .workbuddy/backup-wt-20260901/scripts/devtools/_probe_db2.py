# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import psycopg2

pw_candidates = ['Shangshanruoshui@', '123456', '20051122', 'postgres']
ports = [3309, 5432, 5433, 5434]
dbs = ['zhitu_crawl_db', 'zhilian_crawl_db', 'postgres']

for port in ports:
  for pw in pw_candidates:
    for db in dbs:
      try:
        c = psycopg2.connect(host='127.0.0.1', port=port, user='postgres', password=pw, dbname=db, connect_timeout=2)
        cur = c.cursor()
        cur.execute('SELECT current_database()')
        print('OK', port, db, 'pw=' + pw[:3] + '***', '->', cur.fetchone()[0])
        c.close()
      except Exception as e:
        msg = str(e).split('\n')[0][:80]
        if 'Connection refused' in msg:
          print('REFUSED', port)
          break
        # only print auth fails for first db to reduce noise
        if db == 'zhitu_crawl_db' or 'does not exist' not in msg:
          if 'password authentication failed' in msg or 'does not exist' in msg:
            print('FAIL', port, db, pw[:3]+'***', msg[:60])
    else:
      continue
    break
