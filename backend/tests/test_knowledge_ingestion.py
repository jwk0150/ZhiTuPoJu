# -*- coding: utf-8 -*-
"""Phase 01 — RAG 数据基础测试。

Test 1 真实 Job → Document
Test 2 Document → Chunk
Test 3 Chunk → Embedding
Test 4 Embedding → VectorStore
Test 5 重复 Job 不产生重复 Document
Test 6 文本变化更新版本（旧版本标记 stale）
Test 7 Evidence / Source URL 可回溯

说明：DB 相关用例连接真实本地库（zhitu_crawl_db），
Embedding 相关用例需要模型可用（网络可下载 / 本地缓存），不可用时自动跳过。
"""
from __future__ import annotations

import pytest

from backend.knowledge import service as ks
from backend.knowledge.chunker import build_chunks
from backend.knowledge.cleaner import clean_job, split_jd_sections
from backend.knowledge.ingestion import fetch_jobs, ingest_jobs
from backend.knowledge.embedding import EmbeddingService


# ------------------------------------------------------------
# fixtures
# ------------------------------------------------------------
@pytest.fixture(scope="module")
def db_available() -> bool:
    try:
        rows = fetch_jobs(limit=1)
        return bool(rows)
    except Exception:
        return False


@pytest.fixture(scope="module")
def sample_job(db_available: bool):
    if not db_available:
        pytest.skip("数据库不可用")
    jobs = fetch_jobs(limit=50)
    # 优先选有 description 的岗位
    with_desc = [j for j in jobs if (j.get("job_description") or "").strip()]
    if not with_desc:
        pytest.skip("库中无可用岗位数据")
    return with_desc[0]


@pytest.fixture(scope="module")
def sample_doc(sample_job):
    return clean_job(sample_job)


@pytest.fixture(scope="module")
def embedder():
    svc = EmbeddingService()
    if not svc.is_ready():
        pytest.skip("Embedding 模型不可用（网络/本地缓存缺失）")
    return svc


# ------------------------------------------------------------
# Test 1: 真实 Job → Document
# ------------------------------------------------------------
def test_real_job_to_document(sample_job, sample_doc):
    assert sample_doc["source_type"] == "recruitment"
    assert sample_doc["job_id"] == sample_job["id"]
    assert sample_doc["title"] == sample_job["job_title"]
    assert sample_doc["raw_text"]
    assert len(sample_doc["text_hash"]) == 64
    assert sample_doc["data_version"]
    # source_url 尽量保留
    assert "source_url" in sample_doc


# ------------------------------------------------------------
# Test 2: Document → Chunk
# ------------------------------------------------------------
def test_document_to_chunk(sample_doc):
    chunks = build_chunks(sample_doc)
    assert chunks, "JD 应至少产生一个 chunk"
    for c in chunks:
        assert c["chunk_text"].strip()
        assert c["text_hash"]
        assert c["token_estimate"] > 0
        assert c["section"] in (
            "overview", "duty", "requirement", "bonus", "benefit", "highlight",
            "company", "skills",
        )


def test_jd_section_detection():
    text = (
        "岗位职责：\n1、负责后端服务开发；\n2、参与架构设计。\n\n"
        "任职要求：\n1、本科及以上，3年Java经验；\n2、熟悉Spring Boot。\n\n"
        "加分项：\n有高并发经验优先。"
    )
    sections = split_jd_sections(text)
    names = [s["section"] for s in sections]
    assert "duty" in names
    assert "requirement" in names
    assert "bonus" in names


def test_chunk_fallback_for_no_header():
    text = "这是一段没有任何标题标记的岗位描述文本，" * 40  # 超长无标题
    doc = {
        "sections": [{"section": "overview", "text": text}],
        "skills": [],
        "raw_text": text,
    }
    chunks = build_chunks(doc)
    assert chunks
    for c in chunks:
        assert len(c["chunk_text"]) <= 520


# ------------------------------------------------------------
# Test 3: Chunk → Embedding
# ------------------------------------------------------------
def test_chunk_to_embedding(sample_doc, embedder):
    chunks = build_chunks(sample_doc)
    vectors = embedder.embed([c["chunk_text"] for c in chunks])
    assert len(vectors) == len(chunks)
    assert len(vectors[0]) == embedder.dimension
    # 归一化校验
    norm = sum(v * v for v in vectors[0]) ** 0.5
    assert abs(norm - 1.0) < 1e-3


def test_embedding_chinese_similarity(embedder):
    a = embedder.embed(["精通 Python 开发"])
    b = embedder.embed(["熟练使用 Python 语言"])
    c = embedder.embed(["负责食堂管理"])
    sim_ab = sum(x * y for x, y in zip(a[0], b[0]))
    sim_ac = sum(x * y for x, y in zip(a[0], c[0]))
    assert sim_ab > sim_ac, f"中文语义相似度异常: ab={sim_ab:.3f} ac={sim_ac:.3f}"


# ------------------------------------------------------------
# Test 4: Embedding → VectorStore
# ------------------------------------------------------------
def test_embedding_to_vectorstore(db_available):
    if not db_available:
        pytest.skip("数据库不可用")
    svc = ks.KnowledgeService()
    if not svc.embedding.is_ready():
        pytest.skip("Embedding 模型不可用")
    # 用少量真实岗位（≤5 条）入库
    stats = svc.ingest(limit=5)
    assert stats["chunks_written"] > 0
    hits = svc.semantic_search("Java 后端开发 招聘", top_k=3)
    assert isinstance(hits, list)
    assert all("vec_score" in h for h in hits)
    # 向量可读
    assert svc.vectorstore.count() > 0


# ------------------------------------------------------------
# Test 5: 重复 Job 不产生重复 Document
# ------------------------------------------------------------
def test_duplicate_job_no_duplicate_document(db_available):
    if not db_available:
        pytest.skip("数据库不可用")
    svc = ks.KnowledgeService()
    if not svc.embedding.is_ready():
        pytest.skip("Embedding 模型不可用")
    jobs = fetch_jobs(limit=3)
    job_ids = [j["id"] for j in jobs]

    def _count_docs() -> int:
        import psycopg2
        from backend.config import config
        conn = psycopg2.connect(
            host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
            password=config.PG_PASSWORD, dbname=config.PG_DB,
        )
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT count(*) FROM source_documents WHERE job_id = ANY(%s) "
                "AND document_type='recruitment'",
                (job_ids,),
            )
            return cur.fetchone()[0]
        finally:
            conn.close()

    count_before = _count_docs()
    first = svc.ingest(job_ids=job_ids, limit=len(job_ids))
    count_after_first = _count_docs()
    second = svc.ingest(job_ids=job_ids, limit=len(job_ids))
    count_after_second = _count_docs()

    # 首次入库后新增了文档
    assert first["documents_inserted"] > 0 or first["documents_updated"] > 0
    assert count_after_first >= count_before
    # 二次入库：不产生任何重复 document
    assert second["documents_inserted"] == 0
    assert count_after_second == count_after_first


# ------------------------------------------------------------
# Test 6: 文本变化 → 更新版本（旧版本 stale）
# ------------------------------------------------------------
def test_text_change_updates_version(db_available):
    if not db_available:
        pytest.skip("数据库不可用")
    jobs = fetch_jobs(limit=1)
    if not jobs:
        pytest.skip("无数据")
    job = jobs[0]
    # 首次入库
    svc = ks.KnowledgeService()
    if not svc.embedding.is_ready():
        pytest.skip("Embedding 模型不可用")
    svc.ingest(job_ids=[job["id"]], limit=1)
    # 修改文本（模拟 source 更新），重新入库
    modified = dict(job)
    modified["job_description"] = (job.get("job_description") or "") + "\n新增一段新的岗位说明内容用于版本更新验证。"
    doc = clean_job(modified)
    new_doc_id, inserted = _insert_doc_for_test(doc)
    assert inserted or new_doc_id  # 已入库

    import psycopg2
    from backend.config import config
    conn = psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    )
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT count(*) FROM source_documents WHERE job_id=%s "
            "AND freshness_status='fresh'", (job["id"],),
        )
        fresh = cur.fetchone()[0]
        cur.execute(
            "SELECT count(*) FROM source_documents WHERE job_id=%s "
            "AND freshness_status='stale'", (job["id"],),
        )
        stale = cur.fetchone()[0]
        assert fresh >= 1
        assert stale >= 1, "旧版本应被标记 stale"
    finally:
        conn.close()


def _insert_doc_for_test(doc):
    """直接插入测试用 document（复用 ingestion 内部 upsert）。"""
    from backend.knowledge.ingestion import _connect, _upsert_document, _mark_old_docs_stale
    conn = _connect()
    try:
        with conn.cursor() as cur:
            doc_id, inserted = _upsert_document(cur, doc)
            _mark_old_docs_stale(cur, doc, doc_id)
            conn.commit()
        return doc_id, inserted
    finally:
        conn.close()


# ------------------------------------------------------------
# Test 7: Evidence / Source URL 可回溯
# ------------------------------------------------------------
def test_evidence_source_url_traceback(db_available):
    if not db_available:
        pytest.skip("数据库不可用")
    svc = ks.KnowledgeService()
    if not svc.embedding.is_ready():
        pytest.skip("Embedding 模型不可用")
    jobs = fetch_jobs(limit=2)
    if not jobs:
        pytest.skip("无数据")
    svc.ingest(job_ids=[j["id"] for j in jobs], limit=2)

    # 拿任意一条已入库 chunk 做溯源
    import psycopg2
    from backend.config import config
    conn = psycopg2.connect(
        host=config.PG_HOST, port=config.PG_PORT, user=config.PG_USER,
        password=config.PG_PASSWORD, dbname=config.PG_DB,
    )
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT c.chunk_id, d.source_url FROM document_chunks c "
            "JOIN source_documents d ON d.doc_id=c.doc_id "
            "WHERE d.document_type='recruitment' AND d.source_url IS NOT NULL "
            "AND c.chunk_id = ANY(SELECT chunk_id FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1000) "
            "LIMIT 1"
        )
        row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        pytest.skip("未找到带 source_url 的已入库 chunk")
    chunk_id, source_url = row
    ev = svc.evidence_for_chunk(int(chunk_id))
    assert ev is not None
    assert ev["source_url"] == source_url
    assert ev["doc_id"] is not None


# ============================================================
# Phase 02 — Hybrid Retrieval 测试
# ============================================================
@pytest.fixture(scope="module")
def ready_svc(db_available):
    if not db_available:
        pytest.skip("数据库不可用")
    svc = ks.KnowledgeService()
    if not svc.embedding.is_ready():
        pytest.skip("Embedding 模型不可用")
    svc.ingest(limit=10)  # 确保有数据
    return svc


def test_keyword_search_returns_hits(ready_svc):
    hits = ready_svc.keyword_search("Java", top_k=5)
    assert isinstance(hits, list)
    assert all("kw_score" in h for h in hits)
    assert all(h["job_id"] is not None for h in hits)


def test_hybrid_search_returns_search_hit(ready_svc):
    res = ready_svc.hybrid_search("Java 后端开发", top_k=5)
    assert res["status"] == "OK"
    for h in res["results"]:
        for field in (
            "job_id", "doc_id", "chunk_id", "title", "company", "city", "salary",
            "education", "experience", "snippet", "final_score", "source_name",
            "source_url", "publish_time", "crawl_time", "evidence_id",
        ):
            assert field in h, f"SearchHit 缺少字段 {field}"
        assert h["chunks"], "SearchHit 应保留命中的 chunk"


def test_hybrid_filter_city(ready_svc):
    res = ready_svc.hybrid_search("Java", top_k=10, filters={"city": "北京"})
    if res["status"] == "OK":
        assert all(("北京" in (h["city"] or "")) for h in res["results"])


def test_hybrid_insufficient_evidence(ready_svc):
    res = ready_svc.hybrid_search("完全无关的深海采矿考古岗位", top_k=5)
    assert res["status"] == "INSUFFICIENT_EVIDENCE"
    assert res["results"] == []


def test_search_entrypoint_shape(ready_svc):
    data = ready_svc.search("AI 工程师", top_k=5)
    assert isinstance(data.get("results"), list)
    assert data.get("status") in ("OK", "INSUFFICIENT_EVIDENCE")
    if data["status"] == "OK":
        assert data["results"]
