"""建库脚本 —— 支持任意表前缀（按站名拼音缩写）。

每个爬取站一个独立库，表名带前缀，例如：
  智联 → zhilian_crawl_db 库，zhilian_job_postings + zhilian_job_posting_details 表
  BOSS → boss_crawl_db 库，boss_job_postings + boss_job_posting_details 表

库名约定：{prefix}crawl_db
表名约定：{prefix}job_postings + {prefix}job_posting_details
触发器/函数/视图：保持库内全局名（trg_generate_fingerprint 等），不挂前缀，
              因为 PG 触发器函数是 schema 级，不同站不同库本来就不冲突。

用法：
  python -m crawler.create_schema --prefix zhilian --db-name zhilian_crawl_db
  python -m crawler.create_schema --prefix boss     --db-name boss_crawl_db
  python -m crawler.create_schema --prefix lagou    --db-name lagou_crawl_db
  python -m crawler.create_schema --prefix liepin   --db-name liepin_crawl_db
  python -m crawler.create_schema --prefix mjob     --db-name 51job_crawl_db
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import psycopg

from crawler.config import DB


def _build_sql(prefix: str) -> str:
    """生成带前缀的 DDL。两表用 prefix.job_postings / prefix.job_posting_details。"""
    p = prefix.strip().rstrip("_") + "_" if prefix else ""
    pj = f"{p}job_postings"
    pd = f"{p}job_posting_details"

    return f"""-- ============================================================
-- 站 {prefix or '(default)'} 爬取库 DDL —— {pj} / {pd}
-- ============================================================

-- ---------- 扩展 ----------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 一、查询总表 {pj}
-- ============================================================
CREATE TABLE IF NOT EXISTS {pj} (
    id              BIGSERIAL    PRIMARY KEY,
    source_name     VARCHAR(32)  NOT NULL,
    source_id       VARCHAR(64),
    source_id_hash  VARCHAR(64)  NOT NULL,
    job_title       VARCHAR(255) NOT NULL,
    company_name    VARCHAR(255) NOT NULL,
    city            VARCHAR(64),
    district        VARCHAR(64),
    salary_min      INTEGER,
    salary_max      INTEGER,
    salary_unit     VARCHAR(16)  DEFAULT '元/月',
    experience      VARCHAR(32),
    education       VARCHAR(32),
    job_type        VARCHAR(32),
    publish_time    TIMESTAMP,
    crawl_time      TIMESTAMP    NOT NULL DEFAULT NOW(),
    status          SMALLINT     NOT NULL DEFAULT 0,
    fingerprint     VARCHAR(64),
    completeness    SMALLINT     DEFAULT 0,
    CONSTRAINT uk_{p}source UNIQUE (source_name, source_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_{pj}_title     ON {pj} USING btree (job_title);
CREATE INDEX IF NOT EXISTS idx_{pj}_company   ON {pj} USING btree (company_name);
CREATE INDEX IF NOT EXISTS idx_{pj}_city      ON {pj} USING btree (city);
CREATE INDEX IF NOT EXISTS idx_{pj}_publish   ON {pj} USING btree (publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_{pj}_crawl     ON {pj} USING btree (crawl_time DESC);
CREATE INDEX IF NOT EXISTS idx_{pj}_status    ON {pj} USING btree (status);
CREATE INDEX IF NOT EXISTS idx_{pj}_salary    ON {pj} USING btree (salary_min, salary_max);
CREATE INDEX IF NOT EXISTS idx_{pj}_exp       ON {pj} USING btree (experience);
CREATE INDEX IF NOT EXISTS idx_{pj}_edu       ON {pj} USING btree (education);
CREATE INDEX IF NOT EXISTS idx_{pj}_title_trgm   ON {pj} USING gin (job_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_{pj}_company_trgm ON {pj} USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_{pj}_city_pub  ON {pj} USING btree (city, publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_{pj}_comp_gin  ON {pj} USING gin (status, city, experience);

COMMENT ON TABLE  {pj} IS '{prefix} 站 招聘数据查询总表';
COMMENT ON COLUMN {pj}.id             IS '主键ID';
COMMENT ON COLUMN {pj}.source_name    IS '来源平台名称';
COMMENT ON COLUMN {pj}.source_id      IS '来源平台原始岗位ID';
COMMENT ON COLUMN {pj}.source_id_hash IS '来源ID的SHA256哈希，与source_name共同防重';
COMMENT ON COLUMN {pj}.job_title      IS '职位名称';
COMMENT ON COLUMN {pj}.company_name   IS '公司全称';
COMMENT ON COLUMN {pj}.city           IS '工作城市';
COMMENT ON COLUMN {pj}.district       IS '工作区域/商圈';
COMMENT ON COLUMN {pj}.salary_min     IS '最低薪资（元/月）';
COMMENT ON COLUMN {pj}.salary_max     IS '最高薪资（元/月）';
COMMENT ON COLUMN {pj}.salary_unit    IS '薪资单位，默认 元/月';
COMMENT ON COLUMN {pj}.experience     IS '经验要求';
COMMENT ON COLUMN {pj}.education      IS '学历要求';
COMMENT ON COLUMN {pj}.job_type       IS '职位类型：全职/兼职/实习';
COMMENT ON COLUMN {pj}.publish_time   IS '岗位发布时间';
COMMENT ON COLUMN {pj}.crawl_time     IS '爬取时间';
COMMENT ON COLUMN {pj}.status         IS '状态：0=正常 1=已下架 2=已失效';
COMMENT ON COLUMN {pj}.fingerprint    IS '内容指纹（SHA256），由触发器自动生成';
COMMENT ON COLUMN {pj}.completeness   IS '数据完整度百分比（0-100），由触发器自动计算';

-- ============================================================
-- 二、细节表 {pd}
-- ============================================================
CREATE TABLE IF NOT EXISTS {pd} (
    detail_id            BIGSERIAL    PRIMARY KEY,
    job_id               BIGINT       NOT NULL,
    company_industry     VARCHAR(128),
    company_size         VARCHAR(64),
    company_nature       VARCHAR(64),
    company_intro        TEXT,
    company_address      VARCHAR(512),
    company_logo         VARCHAR(512),
    job_description      TEXT,
    job_requirement      TEXT,
    job_highlights       TEXT,
    job_labels           TEXT[],
    skills               TEXT[],
    benefits             TEXT[],
    keywords             TEXT[],
    work_years_min       INTEGER,
    work_years_max       INTEGER,
    education_required   VARCHAR(32),
    major_required       VARCHAR(128),
    language_required    VARCHAR(64),
    certificate_required VARCHAR(128),
    salary_description   VARCHAR(128),
    salary_months        SMALLINT,
    salary_currency      VARCHAR(16)  DEFAULT 'CNY',
    job_category_l1      VARCHAR(64),
    job_category_l2      VARCHAR(64),
    job_category_l3      VARCHAR(64),
    work_mode            VARCHAR(32),
    work_schedule        VARCHAR(64),
    overtime_status      VARCHAR(32),
    travel_status        VARCHAR(32),
    headcount            INTEGER,
    deadline             DATE,
    contact_name         VARCHAR(64),
    contact_phone        VARCHAR(32),
    contact_email        VARCHAR(128),
    contact_wechat       VARCHAR(64),
    resume_receive_email VARCHAR(128),
    publisher_name       VARCHAR(64),
    publisher_title      VARCHAR(64),
    publisher_avatar     VARCHAR(512),
    response_rate        VARCHAR(16),
    response_time        VARCHAR(16),
    online_status        VARCHAR(16),
    last_active_time     TIMESTAMP,
    interview_count      INTEGER,
    hire_count           INTEGER,
    view_count           INTEGER,
    apply_count         INTEGER,
    favor_count          INTEGER,
    source_url           VARCHAR(1024),
    extra                JSONB,
    raw_html             TEXT,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_{p}detail_job FOREIGN KEY (job_id)
        REFERENCES {pj}(id) ON DELETE CASCADE,
    CONSTRAINT uk_{p}detail_job UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_{pd}_job_id    ON {pd} USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_{pd}_industry  ON {pd} USING btree (company_industry);
CREATE INDEX IF NOT EXISTS idx_{pd}_cat_l1    ON {pd} USING btree (job_category_l1);
CREATE INDEX IF NOT EXISTS idx_{pd}_cat_l2    ON {pd} USING btree (job_category_l2);
CREATE INDEX IF NOT EXISTS idx_{pd}_skills    ON {pd} USING gin (skills);
CREATE INDEX IF NOT EXISTS idx_{pd}_benefits  ON {pd} USING gin (benefits);
CREATE INDEX IF NOT EXISTS idx_{pd}_keywords  ON {pd} USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_{pd}_labels    ON {pd} USING gin (job_labels);
CREATE INDEX IF NOT EXISTS idx_{pd}_extra     ON {pd} USING gin (extra);
CREATE INDEX IF NOT EXISTS idx_{pd}_fulltext  ON {pd} USING gin (
    to_tsvector('simple', coalesce(job_description,'') || ' ' || coalesce(job_requirement,''))
);

COMMENT ON TABLE  {pd} IS '{prefix} 站 招聘数据细节表';
COMMENT ON COLUMN {pd}.detail_id          IS '主键ID';
COMMENT ON COLUMN {pd}.job_id             IS '关联 {pj}.id';
COMMENT ON COLUMN {pd}.raw_html           IS '原始HTML/JSON备份';
COMMENT ON COLUMN {pd}.extra              IS '平台特有字段（JSONB）';

-- ============================================================
-- 三、触发器函数（schema 范围共享，不挂前缀）
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generate_fingerprint_{p}()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fingerprint := encode(
        digest(
            coalesce(NEW.job_title,'') || '|' ||
            coalesce(NEW.company_name,'') || '|' ||
            coalesce(NEW.city,'') || '|' ||
            coalesce(NEW.salary_min::text,'') || '-' || coalesce(NEW.salary_max::text,'') || '|' ||
            coalesce(NEW.experience,'') || '|' ||
            coalesce(NEW.education,''),
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_fingerprint ON {pj};
CREATE TRIGGER trg_generate_fingerprint
    BEFORE INSERT OR UPDATE ON {pj}
    FOR EACH ROW EXECUTE FUNCTION fn_generate_fingerprint_{p}();

CREATE OR REPLACE FUNCTION fn_calculate_completeness_{p}()
RETURNS TRIGGER AS $$
DECLARE filled INTEGER := 0;
BEGIN
    IF NEW.job_title      IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.company_name   IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.city           IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.district       IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.salary_min     IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.salary_max     IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.experience     IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.education      IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.job_type       IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.publish_time   IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.source_id      IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.source_id_hash IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.fingerprint    IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.crawl_time     IS NOT NULL THEN filled := filled + 1; END IF;
    IF NEW.status         IS NOT NULL THEN filled := filled + 1; END IF;
    NEW.completeness := round(filled * 100.0 / 15);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_completeness ON {pj};
CREATE TRIGGER trg_calculate_completeness
    BEFORE INSERT OR UPDATE ON {pj}
    FOR EACH ROW EXECUTE FUNCTION fn_calculate_completeness_{p}();

CREATE OR REPLACE FUNCTION fn_touch_updated_at_{p}()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_updated_at ON {pd};
CREATE TRIGGER trg_touch_updated_at
    BEFORE UPDATE ON {pd}
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at_{p}();

-- ============================================================
-- 四、统计视图 v_{p}collection_stats
-- ============================================================
CREATE OR REPLACE VIEW v_{p}collection_stats AS
SELECT
    source_name,
    city,
    COUNT(*)                                          AS total_count,
    COUNT(*) FILTER (WHERE status = 0)                AS active_count,
    COUNT(*) FILTER (WHERE status = 1)                AS offline_count,
    COUNT(DISTINCT company_name)                      AS company_count,
    round(avg(completeness), 1)                       AS avg_completeness,
    min(publish_time)                                 AS earliest_publish,
    max(publish_time)                                 AS latest_publish,
    min(crawl_time)                                   AS earliest_crawl,
    max(crawl_time)                                   AS latest_crawl
FROM {pj}
GROUP BY source_name, city;

COMMENT ON VIEW v_{p}collection_stats IS '{prefix} 站采集统计视图';
"""


def _admin_dsn_for(dbname: str) -> str:
    """连维护库 postgres 的 DSN（用于 CREATE DATABASE）。"""
    return (f"host={DB.host} port={DB.port} user={DB.user} "
            f"password={DB.password} dbname={dbname}")


def _target_dsn(dbname: str) -> str:
    """连目标库的 DSN。"""
    return (f"host={DB.host} port={DB.port} user={DB.user} "
            f"password={DB.password} dbname={dbname}")


def ensure_database(dbname: str) -> None:
    """确保目标库存在。"""
    with psycopg.connect(_admin_dsn_for("postgres"), autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)
        ).fetchone()
        if exists:
            print(f"• 数据库 {dbname} 已存在")
        else:
            conn.execute(
                f"CREATE DATABASE \"{dbname}\" WITH ENCODING 'UTF8' TEMPLATE template0"
            )
            print(f"✅ 已创建数据库 {dbname}")


def apply_schema(prefix: str, dbname: str) -> None:
    """在目标库执行带前缀的 DDL。"""
    sql = _build_sql(prefix)
    with psycopg.connect(_target_dsn(dbname)) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print(f"✅ 已执行 schema（prefix={prefix}, db={dbname}）")


def verify(prefix: str, dbname: str) -> None:
    p = prefix.strip().rstrip("_") + "_" if prefix else ""
    pj = f"{p}job_postings"
    pd = f"{p}job_posting_details"
    with psycopg.connect(_target_dsn(dbname)) as conn:
        tbls = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
        ).fetchall()
        exts = conn.execute(
            "SELECT extname FROM pg_extension WHERE extname IN "
            "('pg_trgm','btree_gin','pgcrypto') ORDER BY 1"
        ).fetchall()
        views = conn.execute(
            "SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY 1"
        ).fetchall()
        cnt = conn.execute(f"SELECT count(*) FROM {pj}").fetchone()[0] if pj in [t[0] for t in tbls] else 0
        cnt_d = conn.execute(f"SELECT count(*) FROM {pd}").fetchone()[0] if pd in [t[0] for t in tbls] else 0
    print(f"\n—— 验证 prefix={prefix}, db={dbname} ——")
    print(f"表: {sorted(t[0] for t in tbls)}")
    print(f"扩展: {[e[0] for e in exts]}")
    print(f"视图: {[v[0] for v in views]}")
    print(f"{pj}: {cnt} 行  /  {pd}: {cnt_d} 行")


def main() -> None:
    ap = argparse.ArgumentParser(description="建站独立库（带表前缀）")
    ap.add_argument("--prefix", required=True,
                    help="表前缀（站名拼音缩写，如 zhilian / boss / lagou）")
    ap.add_argument("--db-name", default=None,
                    help="数据库名（默认 {prefix}_crawl_db）")
    ap.add_argument("--skip-create-db", action="store_true",
                    help="跳过建库（库已存在时用）")
    args = ap.parse_args()

    dbname = args.db_name or f"{args.prefix}_crawl_db"
    if not args.skip_create_db:
        ensure_database(dbname)
    apply_schema(args.prefix, dbname)
    verify(args.prefix, dbname)
    print(f"\n🎉 {args.prefix} 站库就绪：{dbname}")


if __name__ == "__main__":
    sys.exit(main())