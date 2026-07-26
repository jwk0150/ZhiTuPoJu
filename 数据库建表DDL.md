# 执图破局 — 招聘数据爬取库 DDL

> **数据库名**：`zhitu_crawl_db`
> **PostgreSQL 版本**：15 及以上
> **字符编码**：UTF8
> **用途**：存储从各招聘平台（BOSS 直聘、拉勾、猎聘、51job 等）爬取的岗位数据
> **表结构**：两张表 —— `job_postings`（查询总表）与 `job_posting_details`（细节表），1:1 关系

---

## 一、前置准备

### 1. 创建数据库

```sql
CREATE DATABASE zhitu_crawl_db
    WITH ENCODING 'UTF8'
    LC_COLLATE 'zh_CN.UTF-8'
    LC_CTYPE 'zh_CN.UTF-8'
    TEMPLATE template0;

\c zhitu_crawl_db
```

### 2. 安装扩展

```sql
-- 三元组模糊搜索（用于职位名称、公司名称的模糊匹配）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 让 GIN 索引支持 B-tree 类型（用于复合索引）
CREATE EXTENSION IF NOT EXISTS btree_gin;
```

---

## 二、查询总表 `job_postings`

> 用于列表展示、筛选、排序的轻量级汇总表，字段精简、索引齐全，支撑前台快速查询。

### 建表语句

```sql
CREATE TABLE IF NOT EXISTS job_postings (
    id              BIGSERIAL    PRIMARY KEY,
    source_name     VARCHAR(32)  NOT NULL,                      -- 来源平台名称
    source_id       VARCHAR(64),                                -- 来源平台原始岗位ID
    source_id_hash  VARCHAR(64)  NOT NULL,                      -- 来源ID的SHA256哈希（去重用）
    job_title       VARCHAR(255) NOT NULL,                      -- 职位名称
    company_name    VARCHAR(255) NOT NULL,                      -- 公司全称
    city            VARCHAR(64),                               -- 工作城市
    district        VARCHAR(64),                                -- 工作区域/商圈
    salary_min      INTEGER,                                    -- 最低薪资（元/月）
    salary_max      INTEGER,                                    -- 最高薪资（元/月）
    salary_unit     VARCHAR(16)  DEFAULT '元/月',               -- 薪资单位
    experience      VARCHAR(32),                               -- 经验要求
    education       VARCHAR(32),                               -- 学历要求
    job_type        VARCHAR(32),                               -- 职位类型（全职/兼职/实习）
    publish_time    TIMESTAMP,                                 -- 发布时间
    crawl_time      TIMESTAMP    NOT NULL DEFAULT NOW(),       -- 爬取时间
    status          SMALLINT     NOT NULL DEFAULT 0,            -- 状态：0正常 1下架 2失效
    fingerprint     VARCHAR(64),                               -- 内容指纹（SHA256，触发器自动填充）
    completeness    SMALLINT     DEFAULT 0,                    -- 数据完整度百分比（触发器自动计算）

    CONSTRAINT uk_source UNIQUE (source_name, source_id_hash)
);
```

### 索引

```sql
-- 常规查询索引
CREATE INDEX idx_job_postings_title     ON job_postings USING btree (job_title);
CREATE INDEX idx_job_postings_company   ON job_postings USING btree (company_name);
CREATE INDEX idx_job_postings_city      ON job_postings USING btree (city);
CREATE INDEX idx_job_postings_publish   ON job_postings USING btree (publish_time DESC);
CREATE INDEX idx_job_postings_crawl     ON job_postings USING btree (crawl_time DESC);
CREATE INDEX idx_job_postings_status    ON job_postings USING btree (status);

-- 薪资范围查询
CREATE INDEX idx_job_postings_salary    ON job_postings USING btree (salary_min, salary_max);

-- 经验/学历筛选
CREATE INDEX idx_job_postings_exp       ON job_postings USING btree (experience);
CREATE INDEX idx_job_postings_edu       ON job_postings USING btree (education);

-- 模糊搜索（pg_trgm）
CREATE INDEX idx_job_postings_title_trgm   ON job_postings USING gin (job_title gin_trgm_ops);
CREATE INDEX idx_job_postings_company_trgm ON job_postings USING gin (company_name gin_trgm_ops);

-- 复合筛选
CREATE INDEX idx_job_postings_city_pub  ON job_postings USING btree (city, publish_time DESC);
CREATE INDEX idx_job_postings_comp_gin ON job_postings USING gin (status, city, experience);
```

### 中文注释

```sql
COMMENT ON TABLE  job_postings IS '招聘数据查询总表 —— 存储爬取岗位的汇总信息，用于前台列表、筛选、排序';

COMMENT ON COLUMN job_postings.id             IS '主键ID';
COMMENT ON COLUMN job_postings.source_name     IS '来源平台名称（boss/liepin/lagou/51job 等）';
COMMENT ON COLUMN job_postings.source_id       IS '来源平台的原始岗位ID';
COMMENT ON COLUMN job_postings.source_id_hash  IS '来源ID的SHA256哈希，配合 source_name 做唯一约束防重复';
COMMENT ON COLUMN job_postings.job_title       IS '职位名称';
COMMENT ON COLUMN job_postings.company_name    IS '公司全称';
COMMENT ON COLUMN job_postings.city            IS '工作城市';
COMMENT ON COLUMN job_postings.district        IS '工作区域/商圈';
COMMENT ON COLUMN job_postings.salary_min      IS '最低薪资（元/月）';
COMMENT ON COLUMN job_postings.salary_max      IS '最高薪资（元/月）';
COMMENT ON COLUMN job_postings.salary_unit     IS '薪资单位，默认 元/月';
COMMENT ON COLUMN job_postings.experience      IS '经验要求（如 3-5年）';
COMMENT ON COLUMN job_postings.education       IS '学历要求（如 本科）';
COMMENT ON COLUMN job_postings.job_type        IS '职位类型：全职/兼职/实习';
COMMENT ON COLUMN job_postings.publish_time    IS '岗位发布时间';
COMMENT ON COLUMN job_postings.crawl_time      IS '爬取该条数据的时间';
COMMENT ON COLUMN job_postings.status         IS '状态：0=正常 1=已下架 2=已失效';
COMMENT ON COLUMN job_postings.fingerprint     IS '内容指纹（SHA256），由触发器自动生成，用于判重';
COMMENT ON COLUMN job_postings.completeness    IS '数据完整度百分比（0-100），由触发器自动计算';

COMMENT ON INDEX  job_postings_title_trgm      IS '职位名称三元组模糊搜索索引';
COMMENT ON INDEX  job_postings_company_trgm    IS '公司名称三元组模糊搜索索引';
COMMENT ON CONSTRAINT uk_source               IS '同一平台同一岗位唯一约束（防重复爬取）';
```

---

## 三、细节表 `job_posting_details`

> 存储岗位的完整原始数据，与 `job_postings` 1:1 关联，仅在查看详情时按需加载。

### 建表语句

```sql
CREATE TABLE IF NOT EXISTS job_posting_details (
    detail_id            BIGSERIAL    PRIMARY KEY,
    job_id               BIGINT       NOT NULL,                -- 关联 job_postings.id
    company_industry     VARCHAR(128),                         -- 公司行业
    company_size         VARCHAR(64),                          -- 公司规模
    company_nature       VARCHAR(64),                          -- 公司性质（民营/国企/外资等）
    company_intro        TEXT,                                 -- 公司简介
    company_address      VARCHAR(512),                        -- 公司地址
    company_logo         VARCHAR(512),                        -- 公司Logo URL
    job_description      TEXT,                                 -- 职位描述
    job_requirement      TEXT,                                 -- 任职要求
    job_highlights       TEXT,                                 -- 职位亮点
    job_labels           TEXT[],                               -- 职位标签数组
    skills               TEXT[],                               -- 技能要求数组
    benefits             TEXT[],                               -- 福利待遇数组
    keywords             TEXT[],                               -- 关键词数组
    work_years_min       INTEGER,                              -- 最低工作年限
    work_years_max       INTEGER,                              -- 最高工作年限
    education_required   VARCHAR(32),                          -- 最低学历要求
    major_required       VARCHAR(128),                         -- 专业要求
    language_required    VARCHAR(64),                          -- 语言要求
    certificate_required VARCHAR(128),                         -- 证书要求
    salary_description   VARCHAR(128),                         -- 原始薪资描述文本
    salary_months        SMALLINT,                             -- 薪资月数（如 13薪=13）
    salary_currency      VARCHAR(16)  DEFAULT 'CNY',          -- 薪资货币
    job_category_l1      VARCHAR(64),                          -- 职位一级分类
    job_category_l2      VARCHAR(64),                          -- 职位二级分类
    job_category_l3      VARCHAR(64),                          -- 职位三级分类
    work_mode            VARCHAR(32),                          -- 工作方式（坐班/远程/混合）
    work_schedule        VARCHAR(64),                          -- 工作制（如 965/996）
    overtime_status     VARCHAR(32),                          -- 加班情况
    travel_status       VARCHAR(32),                          -- 出差情况
    headcount            INTEGER,                              -- 招聘人数
    deadline             DATE,                                -- 投递截止日期
    contact_name         VARCHAR(64),                          -- 联系人姓名
    contact_phone        VARCHAR(32),                          -- 联系电话
    contact_email        VARCHAR(128),                         -- 联系邮箱
    contact_wechat       VARCHAR(64),                          -- 联系微信
    resume_receive_email VARCHAR(128),                         -- 简历接收邮箱
    publisher_name       VARCHAR(64),                          -- 发布人姓名（如 HR）
    publisher_title      VARCHAR(64),                          -- 发布人职位
    publisher_avatar     VARCHAR(512),                         -- 发布人头像URL
    response_rate        VARCHAR(16),                          -- HR回复率
    response_time       VARCHAR(16),                          -- HR平均回复时长
    online_status        VARCHAR(16),                          -- HR在线状态
    last_active_time     TIMESTAMP,                           -- HR最近活跃时间
    interview_count      INTEGER,                             -- 面试人数
    hire_count           INTEGER,                             -- 录用人数
    view_count           INTEGER,                             -- 浏览次数
    apply_count          INTEGER,                             -- 投递次数
    favor_count          INTEGER,                             -- 收藏次数
    source_url           VARCHAR(1024),                        -- 原始岗位链接
    extra                JSONB,                               -- 平台特有字段（见下方说明）
    raw_html             TEXT,                                -- 原始HTML（备份留底）
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),  -- 记录创建时间
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),  -- 记录更新时间

    CONSTRAINT fk_detail_job FOREIGN KEY (job_id)
        REFERENCES job_postings(id) ON DELETE CASCADE,
    CONSTRAINT uk_detail_job UNIQUE (job_id)
);
```

### 索引

```sql
-- 主关联索引
CREATE INDEX idx_detail_job_id          ON job_posting_details USING btree (job_id);

-- 行业/分类筛选
CREATE INDEX idx_detail_industry        ON job_posting_details USING btree (company_industry);
CREATE INDEX idx_detail_cat_l1          ON job_posting_details USING btree (job_category_l1);
CREATE INDEX idx_detail_cat_l2          ON job_posting_details USING btree (job_category_l2);

-- 数组字段 GIN 索引
CREATE INDEX idx_detail_skills          ON job_posting_details USING gin (skills);
CREATE INDEX idx_detail_benefits        ON job_posting_details USING gin (benefits);
CREATE INDEX idx_detail_keywords       ON job_posting_details USING gin (keywords);
CREATE INDEX idx_detail_labels          ON job_posting_details USING gin (job_labels);

-- JSONB 字段索引
CREATE INDEX idx_detail_extra           ON job_posting_details USING gin (extra);

-- 全文检索
CREATE INDEX idx_detail_fulltext        ON job_posting_details USING gin (
    to_tsvector('simple', coalesce(job_description,'') || ' ' || coalesce(job_requirement,''))
);
```

### 中文注释

```sql
COMMENT ON TABLE  job_posting_details IS '招聘数据细节表 —— 存储岗位完整原始数据，与 job_postings 1:1 关联';

COMMENT ON COLUMN job_posting_details.detail_id            IS '主键ID';
COMMENT ON COLUMN job_posting_details.job_id               IS '关联 job_postings.id';
COMMENT ON COLUMN job_posting_details.company_industry     IS '公司行业';
COMMENT ON COLUMN job_posting_details.company_size         IS '公司规模（如 100-499人）';
COMMENT ON COLUMN job_posting_details.company_nature       IS '公司性质（民营/国企/外资/合资等）';
COMMENT ON COLUMN job_posting_details.company_intro        IS '公司简介';
COMMENT ON COLUMN job_posting_details.company_address      IS '公司详细地址';
COMMENT ON COLUMN job_posting_details.company_logo         IS '公司Logo图片URL';
COMMENT ON COLUMN job_posting_details.job_description     IS '职位描述正文';
COMMENT ON COLUMN job_posting_details.job_requirement     IS '任职要求正文';
COMMENT ON COLUMN job_posting_details.job_highlights      IS '职位亮点';
COMMENT ON COLUMN job_posting_details.job_labels           IS '职位标签数组';
COMMENT ON COLUMN job_posting_details.skills              IS '技能要求数组';
COMMENT ON COLUMN job_posting_details.benefits            IS '福利待遇数组';
COMMENT ON COLUMN job_posting_details.keywords            IS '关键词数组';
COMMENT ON COLUMN job_posting_details.work_years_min      IS '最低工作年限';
COMMENT ON COLUMN job_posting_details.work_years_max      IS '最高工作年限';
COMMENT ON COLUMN job_posting_details.education_required  IS '最低学历要求';
COMMENT ON COLUMN job_posting_details.major_required      IS '专业要求';
COMMENT ON COLUMN job_posting_details.language_required   IS '语言要求';
COMMENT ON COLUMN job_posting_details.certificate_required IS '证书要求';
COMMENT ON COLUMN job_posting_details.salary_description   IS '原始薪资描述文本（如 15-25K·14薪）';
COMMENT ON COLUMN job_posting_details.salary_months        IS '薪资月数（13薪=13）';
COMMENT ON COLUMN job_posting_details.salary_currency     IS '薪资货币，默认 CNY';
COMMENT ON COLUMN job_posting_details.job_category_l1     IS '职位一级分类';
COMMENT ON COLUMN job_posting_details.job_category_l2     IS '职位二级分类';
COMMENT ON COLUMN job_posting_details.job_category_l3     IS '职位三级分类';
COMMENT ON COLUMN job_posting_details.work_mode           IS '工作方式（坐班/远程/混合）';
COMMENT ON COLUMN job_posting_details.work_schedule       IS '工作制（965/996/大小周等）';
COMMENT ON COLUMN job_posting_details.overtime_status     IS '加班情况';
COMMENT ON COLUMN job_posting_details.travel_status       IS '出差情况';
COMMENT ON COLUMN job_posting_details.headcount           IS '招聘人数';
COMMENT ON COLUMN job_posting_details.deadline           IS '投递截止日期';
COMMENT ON COLUMN job_posting_details.contact_name        IS '联系人姓名';
COMMENT ON COLUMN job_posting_details.contact_phone       IS '联系电话';
COMMENT ON COLUMN job_posting_details.contact_email      IS '联系邮箱';
COMMENT ON COLUMN job_posting_details.contact_wechat      IS '联系微信';
COMMENT ON COLUMN job_posting_details.resume_receive_email IS '简历接收邮箱';
COMMENT ON COLUMN job_posting_details.publisher_name      IS '发布人姓名（如 HR）';
COMMENT ON COLUMN job_posting_details.publisher_title     IS '发布人职位';
COMMENT ON COLUMN job_posting_details.publisher_avatar    IS '发布人头像URL';
COMMENT ON COLUMN job_posting_details.response_rate       IS 'HR回复率';
COMMENT ON COLUMN job_posting_details.response_time      IS 'HR平均回复时长';
COMMENT ON COLUMN job_posting_details.online_status      IS 'HR在线状态';
COMMENT ON COLUMN job_posting_details.last_active_time    IS 'HR最近活跃时间';
COMMENT ON COLUMN job_posting_details.interview_count    IS '面试人数';
COMMENT ON COLUMN job_posting_details.hire_count          IS '录用人数';
COMMENT ON COLUMN job_posting_details.view_count          IS '浏览次数';
COMMENT ON COLUMN job_posting_details.apply_count         IS '投递次数';
COMMENT ON COLUMN job_posting_details.favor_count        IS '收藏次数';
COMMENT ON COLUMN job_posting_details.source_url          IS '原始岗位页面URL';
COMMENT ON COLUMN job_posting_details.extra              IS '平台特有字段（JSONB），见下方说明';
COMMENT ON COLUMN job_posting_details.raw_html           IS '原始HTML备份';
COMMENT ON COLUMN job_posting_details.created_at         IS '记录创建时间';
COMMENT ON COLUMN job_posting_details.updated_at         IS '记录更新时间';

COMMENT ON INDEX  job_posting_details_skills              IS '技能要求数组GIN索引，支持包含查询';
COMMENT ON INDEX  job_posting_details_benefits            IS '福利待遇数组GIN索引';
COMMENT ON INDEX  job_posting_details_keywords            IS '关键词数组GIN索引';
COMMENT ON INDEX  job_posting_details_extra               IS 'JSONB扩展字段GIN索引';
COMMENT ON INDEX  job_posting_details_fulltext             IS '职位描述+要求的全文检索索引';
COMMENT ON CONSTRAINT fk_detail_job                       IS '外键约束，删除总表记录时级联删除细节';
COMMENT ON CONSTRAINT uk_detail_job                       IS '一个岗位只对应一条细节记录';
```

---

## 四、`extra` JSONB 字段使用说明

不同平台爬取到的特有字段统一存入 `extra`，无需频繁改表：

```sql
-- BOSS直聘示例
{"boss_active": "刚刚活跃", "brand_stage": "已上市", "risk_level": "低"}

-- 拉勾示例
{"is_urgent": true, "resume_process_rate": "95%", "employee_count_exact": 320}

-- 猎聘示例
{"is_headhunt": true, "headhunt_name": "某某猎头", "annual_salary": "30万-50万"}

-- 51job示例
{"welfare_tags": ["五险一金","补充医疗","年终双薪"], "apply_url": "https://..."}
```

查询示例：

```sql
-- 查询所有紧急招聘的岗位
SELECT * FROM job_posting_details WHERE extra @> '{"is_urgent": true}';

-- 查询有"五险一金"标签的岗位
SELECT * FROM job_posting_details WHERE extra -> 'welfare_tags' ? '五险一金';
```

---

## 五、触发器

### 1. 自动生成内容指纹

> 在插入/更新 `job_postings` 时，自动对核心字段做 SHA256 哈希写入 `fingerprint`，用于判重。

```sql
CREATE OR REPLACE FUNCTION fn_generate_fingerprint()
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

-- 需要 pgcrypto 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TRIGGER trg_generate_fingerprint
    BEFORE INSERT OR UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION fn_generate_fingerprint();

COMMENT ON FUNCTION fn_generate_fingerprint IS '自动生成岗位内容指纹（SHA256），用于判重';
COMMENT ON TRIGGER  trg_generate_fingerprint ON job_postings IS '插入/更新前自动计算指纹';
```

### 2. 自动计算数据完整度

> 根据 15 个关键字段是否非空，计算 `completeness` 百分比（0-100）。

```sql
CREATE OR REPLACE FUNCTION fn_calculate_completeness()
RETURNS TRIGGER AS $$
DECLARE
    filled INTEGER := 0;
    total INTEGER := 15;
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

    NEW.completeness := round(filled * 100.0 / total);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_completeness
    BEFORE INSERT OR UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION fn_calculate_completeness();

COMMENT ON FUNCTION fn_calculate_completeness IS '根据15个关键字段填充情况自动计算数据完整度百分比';
COMMENT ON TRIGGER  trg_calculate_completeness ON job_postings IS '插入/更新前自动计算完整度';
```

---

## 六、统计视图 `v_collection_stats`

> 为后台仪表盘提供采集数据 KPI 汇总。

```sql
CREATE OR REPLACE VIEW v_collection_stats AS
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
FROM job_postings
GROUP BY source_name, city;

COMMENT ON VIEW v_collection_stats IS '采集数据统计视图 —— 按平台+城市维度汇总KPI';
```

---

## 七、执行顺序

> 请严格按照以下顺序执行，否则外键、触发器会报错：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 创建数据库 | 第一节 |
| 2 | 安装扩展 | `pg_trgm`、`btree_gin`、`pgcrypto` |
| 3 | 创建 `job_postings` 表 | 第二节建表语句 |
| 4 | 创建 `job_postings` 索引 | 第二节索引语句 |
| 5 | 添加 `job_postings` 注释 | 第二节注释语句 |
| 6 | 创建 `job_posting_details` 表 | 第三节建表语句 |
| 7 | 创建 `job_posting_details` 索引 | 第三节索引语句 |
| 8 | 添加 `job_posting_details` 注释 | 第三节注释语句 |
| 9 | 创建触发器函数与触发器 | 第五节 |
| 10 | 创建统计视图 | 第六节 |

---

## 八、快速验证

建库完成后，执行以下语句验证：

```sql
-- 验证表
\dt job_postings job_posting_details

-- 验证扩展
SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm','btree_gin','pgcrypto');

-- 验证触发器
SELECT tgname FROM pg_trigger WHERE tgrelid IN ('job_postings'::regclass);

-- 验证视图
\dv v_collection_stats

-- 插入测试数据
INSERT INTO job_postings (source_name, source_id, source_id_hash, job_title, company_name, city, salary_min, salary_max)
VALUES ('boss', 'test123', 'hash_test123', 'Java开发工程师', '测试科技有限公司', '北京', 15000, 25000)
RETURNING id, fingerprint, completeness;
```

如果 `RETURNING` 能返回自动生成的 `fingerprint` 和 `completeness` 值，说明触发器工作正常。
