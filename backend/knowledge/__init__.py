# -*- coding: utf-8 -*-
"""RAG 数据基础层（Phase 01）。

只提供数据基础设施：
- embedding.py   : EmbeddingService（模型可替换）
- vectorstore.py : VectorStore 抽象 + Cube/PgVector 实现
- cleaner.py     : 招聘数据清洗（复用 crawler/parser.py）
- chunker.py     : JD 语义切分 + fallback 切块
- ingestion.py   : Job → Document → Chunk → Embedding 增量入库
- service.py     : KnowledgeService（门面，含基础向量检索，非最终 Hybrid）

本阶段不实现：Agent / Matching / RAG Answer / Hybrid Search。
"""
