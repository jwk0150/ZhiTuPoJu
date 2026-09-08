-- ============================================================
-- 执图破局 · 数据库视图口径（唯一事实源）
-- 2026-09-08 固化：the_total_table 视图从空表 copy1 重指 map_data_table
-- 事故背景：地图/图谱等模块数据缺失，根因是视图指向的 copy1 为空表
-- 权威数据源：map_data_table（岗位主数据，38,780 行）
-- 模块依赖清单（backend/ 运行时表引用）：
--   the_total_table(视图)      services.py 全部业务查询（地图/图谱/发现/匹配）
--   map_data_table             视图底表（权威）
--   job_posting_details        12,452 行（历史主表，保留）
--   new_skill_table            岗位技术池（25 行）
--   user_center.*              用户系统（profiles/abilities 等）
--   init_database.py 引用的 zhilian_job_postings / document_chunks
--                              仅初始化脚本使用，远端库可不建（有容错）
-- 重新应用：psql -f deploy/schema_views.sql
-- ============================================================

CREATE OR REPLACE VIEW the_total_table AS
SELECT
    id::bigint AS id,
    source_name::varchar(32) AS source_name,
    source_id::varchar(64) AS source_id,
    source_id_hash::varchar(64) AS source_id_hash,
    job_title::varchar(255) AS job_title,
    company_name::varchar(255) AS company_name,
    city::varchar(64) AS city,
    district::varchar(64) AS district,
    salary_min::integer AS salary_min,
    salary_max::integer AS salary_max,
    salary_unit::varchar(16) AS salary_unit,
    experience::varchar(32) AS experience,
    education::varchar(32) AS education,
    job_type::varchar(32) AS job_type,
    publish_time::timestamp without time zone AS publish_time,
    crawl_time::timestamp without time zone AS crawl_time,
    status::smallint AS status,
    fingerprint::varchar(64) AS fingerprint,
    completeness::smallint AS completeness,
    source_name::varchar(32) AS data_source,
    industry_tags::character varying AS industry_tags,
    skills::text AS skills,
    job_description::text AS job_description,
    qualification::varchar(32) AS qualification,
    work_experience::varchar(32) AS work_experience,
    city_seed::text AS city_seed,
    sort_weight::double precision AS sort_weight,
    NULL::varchar(128) AS company_industry,
    NULL::varchar(64) AS company_size,
    NULL::varchar(64) AS company_nature,
    NULL::text AS job_requirement,
    NULL::text AS job_highlights,
    NULL::text[] AS job_labels,
    NULL::text[] AS benefits,
    NULL::text[] AS keywords,
    NULL::varchar(64) AS job_category_l1,
    NULL::varchar(64) AS job_category_l2,
    NULL::varchar(64) AS job_category_l3,
    NULL::varchar(32) AS work_mode,
    NULL::varchar(512) AS company_address,
    NULL::varchar(1024) AS source_url,
    NULL::jsonb AS extra,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at
FROM map_data_table;