# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def try_connect(port, db, password):
    try:
        import psycopg2
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary', '-q'])
        import psycopg2
    try:
        c = psycopg2.connect(host='127.0.0.1', port=port, user='postgres', password=password, dbname=db, connect_timeout=5)
        cur = c.cursor()
        cur.execute("SELECT current_database()")
        dbname = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
        n = cur.fetchone()[0]
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1 LIMIT 15")
        tables = [r[0] for r in cur.fetchall()]
        c.close()
        return {'ok': True, 'db': dbname, 'tables': n, 'sample': tables}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

pw = 'Shangshanruoshui@'
for port, db in [(5432, 'zhitu_crawl_db'), (5432, 'zhilian_crawl_db'), (3309, 'zhilian_crawl_db'), (3309, 'zhitu_crawl_db')]:
    r = try_connect(port, db, pw)
    print(port, db, r)
# also old password
r = try_connect(3309, 'zhilian_crawl_db', '123456')
print(3309, 'zhilian_crawl_db', 'oldpwd', r)
