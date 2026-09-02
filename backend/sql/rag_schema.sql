-- ============================================================
-- RAG 基础设施 Schema（Phase 01）—— 幂等、最小必要修改
-- 原则：
--   * 只 ALTER ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   * 禁止 DROP TABLE / DROP COLUMN / DELETE / TRUNCATE
--   * 不清空、不修改现有 OpenAlex 数据
--   * 新增列一律允许 NULL（避免把历史 academic_paper 误标为 recruitment）
--
-- 向量列类型说明（实测结论）：
--   * 本机 PostgreSQL 17.10（Windows 构建）cube 扩展单点上限 = 100 维，
--     无法承载 512 维 BGE 向量 → 开发阶段使用 double precision[] + numpy 余弦兜底
--   * 未来安装 pgvector 后：ALTER document_chunks ALTER embedding TYPE vector(512)
--     并改为 hnsw 索引（仅需切换 VectorStore 实现，业务代码不变）
-- ============================================================

-- ---------- 扩展 ----------
-- 说明：Phase 01 不依赖 cube（100 维限制不满足 512 维 embedding）。
-- pg_trgm / btree_gin / pgcrypto 已在爬虫 DDL 中安装，此处不重复。

-- ============================================================
-- 一、source_documents —— Unified Document 扩展
-- ============================================================
ALTER TABLE source_documents
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(32),        -- recruitment / company_website / policy / industry
    ADD COLUMN IF NOT EXISTS job_id         BIGINT,            -- 回链 job_postings.id（recruitment）
    ADD COLUMN IF NOT EXISTS company_name   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city           VARCHAR(64),
    ADD COLUMN IF NOT EXISTS data_version   VARCHAR(32);       -- 数据版本，便于增量重建

-- ============================================================
-- 二、document_chunks —— Unified Chunk 扩展
-- ============================================================
ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding      double precision[], -- 512 维归一化向量（数组兜底；pgvector 就绪后改 vector(512)）
    ADD COLUMN IF NOT EXISTS job_id         BIGINT,             -- 过滤快照（只读引用，不复制业务主数据）
    ADD COLUMN IF NOT EXISTS document_type  VARCHAR(32),
    ADD COLUMN IF NOT EXISTS city           VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_name    VARCHAR(32),
    ADD COLUMN IF NOT EXISTS publish_time   TIMESTAMP,
    ADD COLUMN IF NOT EXISTS crawl_time     TIMESTAMP;

-- ============================================================
-- 三、evidence_items —— Evidence / Provenance 扩展
-- ============================================================
ALTER TABLE evidence_items
    ADD COLUMN IF NOT EXISTS job_id        BIGINT,             -- 回链岗位
    ADD COLUMN IF NOT EXISTS chunk_id      BIGINT,             -- 回链 chunk
    ADD COLUMN IF NOT EXISTS claim_type    VARCHAR(32),        -- skill_match / requirement_match / reason / ...
    ADD COLUMN IF NOT EXISTS source_url    TEXT,
    ADD COLUMN IF NOT EXISTS uncertainty   NUMERIC DEFAULT 0;  -- 0~1，证据不足时升高

-- ============================================================
-- 四、Document 身份（Phase 02 修复）
-- 招聘 Document 以 source_type + job_id 为唯一身份：
--   相同正文可以有相同 text_hash，但不同 Job 不得共享 Document。
-- 模型：每个 job 至多一条 fresh 文档 + 可保留 N 条 stale 历史版本（不删除）。
-- 1) 移除旧约束 UNIQUE(source_type, text_hash)（不同 Job 正文相同时会共享文档）
-- 2) 历史脏数据修复：同一 (source_type, job_id) 多条记录时，保留最新一条 fresh，
--    其余标记 stale（最小安全修正，不删除任何数据）
-- 3) 部分唯一索引：WHERE job_id IS NOT NULL AND freshness_status <> 'stale'
-- academic_paper 历史数据 job_id 为 NULL，不受影响、不删除。
-- ============================================================
ALTER TABLE source_documents
    DROP CONSTRAINT IF EXISTS source_documents_source_type_text_hash_key;

-- 历史脏数据修复（幂等）：仅影响 recruitment 重复记录，保留最新、其余标记 stale
UPDATE source_documents SET freshness_status = 'stale'
WHERE document_type = 'recruitment' AND job_id IS NOT NULL
  AND freshness_status <> 'stale'
  AND doc_id NOT IN (
      SELECT DISTINCT ON (source_type, job_id) doc_id
      FROM source_documents
      WHERE document_type = 'recruitment' AND job_id IS NOT NULL
      ORDER BY source_type, job_id, collected_at DESC, doc_id DESC
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sd_source_job
    ON source_documents (source_type, job_id)
    WHERE job_id IS NOT NULL AND freshness_status <> 'stale';

-- ============================================================
-- 五、索引（幂等）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chunks_job       ON document_chunks (job_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_type  ON document_chunks (document_type);
CREATE INDEX IF NOT EXISTS idx_chunks_fresh     ON source_documents (freshness_status);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_job   ON source_documents (job_id);
CREATE INDEX IF NOT EXISTS idx_evidence_job     ON evidence_items (job_id);
-- Evidence 去重（Phase 04）：同一 job+chunk+claim 只保留一条，幂等 upsert
CREATE UNIQUE INDEX IF NOT EXISTS uniq_evidence_job_chunk
    ON evidence_items (job_id, chunk_id, claim_type)
    WHERE job_id IS NOT NULL AND chunk_id IS NOT NULL;
-- 数组列无向量索引（检索走 numpy 精确余弦）；pgvector 就绪后建 hnsw
