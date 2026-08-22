-- ============================================================
-- 用户中心智能职业画像模块 — 数据库建表 DDL
-- PostgreSQL 15 / zhitu_crawl_db
-- Schema: user_center
-- ============================================================

BEGIN;

-- 1. 创建 schema
CREATE SCHEMA IF NOT EXISTS user_center;

-- 2. 用户资料表
CREATE TABLE IF NOT EXISTS user_center.user_profiles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL UNIQUE,
    name        VARCHAR(128),
    school      VARCHAR(256),
    major       VARCHAR(256),
    education   VARCHAR(64),          -- 本科 / 硕士 / 博士 / 大专
    grade       VARCHAR(32),          -- 2024级 / 应届
    target_job  VARCHAR(256),
    bio         TEXT,
<<<<<<< HEAD
=======
    phone       VARCHAR(32),
    email       VARCHAR(128),
    interview_data JSONB,
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
    avatar_url  VARCHAR(512),
    completion  SMALLINT DEFAULT 0,   -- 0-100 资料完整度百分比
    created_at  TIMESTAMP  DEFAULT NOW(),
    updated_at  TIMESTAMP  DEFAULT NOW()
);

<<<<<<< HEAD
=======
-- 兼容早期版本：模型已使用这些字段，旧数据库可能尚未补齐。
ALTER TABLE user_center.user_profiles
    ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS email VARCHAR(128),
    ADD COLUMN IF NOT EXISTS interview_data JSONB;

>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
-- 3. 简历表
CREATE TABLE IF NOT EXISTS user_center.resumes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    filename    VARCHAR(512),
    filepath    VARCHAR(1024),
    file_type   VARCHAR(16),          -- pdf / doc / docx / txt
    content     TEXT,                 -- 提取后的纯文本
    status      VARCHAR(32)  DEFAULT 'uploaded',  -- uploaded / parsed / analyzed / error
    created_at  TIMESTAMP    DEFAULT NOW(),
    updated_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON user_center.resumes(user_id);

-- 4. 技能画像表
CREATE TABLE IF NOT EXISTS user_center.user_skills (
    id          BIGSERIAL PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    skill_name  VARCHAR(128) NOT NULL,
    category    VARCHAR(64),          -- 编程语言 / 框架 / 工具 / 领域知识 / 软技能
    level       VARCHAR(32),          -- 入门 / 熟练 / 精通 / 专家
    score       SMALLINT     DEFAULT 50,  -- 0-100
    source      VARCHAR(32),          -- resume / interview / manual
    created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_center.user_skills(user_id);

-- 5. 职业分析报告表
CREATE TABLE IF NOT EXISTS user_center.career_reports (
    id                BIGSERIAL PRIMARY KEY,
    user_id           VARCHAR(64) NOT NULL,
    -- 六维雷达图评分 0-100
    tech_score        SMALLINT DEFAULT 0,
    project_score     SMALLINT DEFAULT 0,
    data_score        SMALLINT DEFAULT 0,
    engineering_score SMALLINT DEFAULT 0,
    innovation_score  SMALLINT DEFAULT 0,
    learning_score    SMALLINT DEFAULT 0,
    overall_score     SMALLINT DEFAULT 0,
    -- 结构化字段
    advantages        TEXT[],       -- 优势列表
    weaknesses        TEXT[],       -- 不足列表
    suggestions       TEXT[],       -- 成长建议
    match_jobs        JSONB,        -- [{job_id, title, company, match_score}]
    raw_analysis      JSONB,        -- 完整 AI 原始返回
    created_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_career_reports_user ON user_center.career_reports(user_id);

COMMIT;
