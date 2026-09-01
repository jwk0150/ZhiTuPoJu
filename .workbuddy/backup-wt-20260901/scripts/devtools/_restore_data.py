"""从 zhilian_roundtrip.jsonl.gz 恢复数据到 PostgreSQL"""
import gzip, json, asyncio, asyncpg
from datetime import datetime

# TIMESTAMP / DATE 类型字段
TS_FIELDS = {'publish_time', 'crawl_time', 'created_at', 'updated_at', 'last_active_time', 'deadline'}

def convert_value(v, col):
    """转换字段值"""
    if v is None:
        return None
    if col in TS_FIELDS and isinstance(v, str):
        # 尝试多种日期格式
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
            try:
                return datetime.strptime(v, fmt)
            except ValueError:
                continue
        return v
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, bool):
        return v
    return v

def convert_row(row_dict, columns):
    """转换整行数据"""
    return tuple(convert_value(row_dict.get(c), c) for c in columns)

async def restore():
    conn = await asyncpg.connect(
        host='127.0.0.1', port=5432,
        user='postgres', password='123456',
        database='zhilian_crawl_db'
    )

    # 清空
    await conn.execute("DELETE FROM job_posting_details")
    await conn.execute("DELETE FROM job_postings")
    await conn.execute("ALTER SEQUENCE IF EXISTS job_postings_id_seq RESTART WITH 1")
    await conn.execute("ALTER SEQUENCE IF EXISTS job_posting_details_detail_id_seq RESTART WITH 1")
    print("已清空")

    f = gzip.open('exports/zhilian_roundtrip.jsonl.gz')
    postings_rows = []
    details_rows = []

    for line in f:
        obj = json.loads(line)
        if obj.get('_meta'):
            continue
        table = obj.pop('_table', 'job_postings')
        if table == 'job_postings':
            postings_rows.append(obj)
        elif table == 'job_posting_details':
            details_rows.append(obj)
    f.close()

    print(f"读取: {len(postings_rows)} postings + {len(details_rows)} details")

    # 插入 job_postings
    if postings_rows:
        cols = list(postings_rows[0].keys())
        cols_s = ','.join(cols)
        rows = [convert_row(r, cols) for r in postings_rows]
        await conn.copy_records_to_table('job_postings', records=rows, columns=cols)
        # 恢复序列
        max_id = max(r['id'] for r in postings_rows)
        await conn.execute(f"SELECT setval('job_postings_id_seq', {max_id})")
        print(f"  job_postings 插入 {len(rows)} 条, 序列->{max_id}")

    # 插入 job_posting_details
    if details_rows:
        cols = list(details_rows[0].keys())
        rows = [convert_row(r, cols) for r in details_rows]
        await conn.copy_records_to_table('job_posting_details', records=rows, columns=cols)
        max_id = max(r['detail_id'] for r in details_rows)
        await conn.execute(f"SELECT setval('job_posting_details_detail_id_seq', {max_id})")
        print(f"  details 插入 {len(rows)} 条, 序列->{max_id}")

    # 验证
    cnt = await conn.fetchval("SELECT count(*) FROM job_postings")
    cnt2 = await conn.fetchval("SELECT count(*) FROM job_posting_details")
    print(f"\n恢复完成! job_postings: {cnt}, details: {cnt2}")

    # 创建 the_total_table 视图
    await conn.execute("DROP VIEW IF EXISTS the_total_table")
    await conn.execute("""
        CREATE VIEW the_total_table AS
        SELECT
            jp.id, jp.source_name, jp.job_title, jp.company_name,
            jp.city, jp.district, jp.salary_min, jp.salary_max,
            jp.salary_unit, jp.experience, jp.education, jp.job_type,
            jp.publish_time, jp.crawl_time, jp.status, jp.fingerprint,
            jp.completeness,
            jpd.company_industry, jpd.company_size, jpd.company_nature,
            jpd.job_description, jpd.job_requirement, jpd.job_highlights,
            jpd.job_labels, jpd.skills, jpd.benefits, jpd.keywords,
            jpd.job_category_l1, jpd.job_category_l2, jpd.job_category_l3,
            jpd.work_mode, jpd.company_address, jpd.source_url,
            jpd.extra, jpd.created_at, jpd.updated_at
        FROM job_postings jp
        LEFT JOIN job_posting_details jpd ON jp.id = jpd.job_id
    """)
    print("已创建 the_total_table 视图")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(restore())
