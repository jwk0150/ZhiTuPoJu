# -*- coding: utf-8 -*-
"""EmbeddingService —— 统一文本向量化接口。

设计约束：
- 模型可配置（config.EMBEDDING_MODEL）
- 维度可配置且与模型强校验（config.EMBEDDING_DIM）
- embedding_version 可配置（向量失效/重建依据）
- 不硬编码任何 API Key；业务代码只依赖本服务，不依赖具体模型
- 输出为归一化单位向量（配合 cube 扩展做余弦检索；pgvector 同样适用）
"""
from __future__ import annotations

import threading
from typing import Any

from backend.config import config

# BGE 检索场景官方建议的 query 前缀；非 bge 系列模型可置空
_QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章："


class EmbeddingService:
    """本地 sentence-transformers 向量化服务（懒加载，CPU 优先）。"""

    def __init__(
        self,
        model_name: str | None = None,
        dimension: int | None = None,
        embedding_version: str | None = None,
        device: str | None = None,
    ) -> None:
        self.model_name = model_name or config.EMBEDDING_MODEL
        self.embedding_version = embedding_version or config.EMBEDDING_VERSION
        self.device = device or config.EMBEDDING_DEVICE
        self._dimension = int(dimension or config.EMBEDDING_DIM)
        self._model: Any | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------
    # 模型加载（懒加载：首次 embed 时才下载/加载）
    # ------------------------------------------------------------
    def _load(self) -> Any:
        if self._model is None:
            with self._lock:
                if self._model is None:
                    try:
                        from sentence_transformers import SentenceTransformer
                    except ImportError as exc:
                        raise RuntimeError(
                            f"Embedding model '{self.model_name}' 需要 sentence-transformers 包；"
                            f"请在运行环境中执行 `pip install sentence-transformers` 后重启服务。"
                            f"（当前 Python 环境未安装该包 — {exc}）"
                        ) from exc

                    model = SentenceTransformer(self.model_name, device=self.device)
                    if hasattr(model, "get_embedding_dimension"):
                        dim = int(model.get_embedding_dimension())
                    else:
                        dim = int(model.get_sentence_embedding_dimension())
                    if dim != self._dimension:
                        raise RuntimeError(
                            f"模型 {self.model_name} 实际维度 {dim} "
                            f"与配置维度 {self._dimension} 不一致，请修正 EMBEDDING_DIM"
                        )
                    self._model = model
        return self._model

    @property
    def dimension(self) -> int:
        return self._dimension

    def is_ready(self) -> bool:
        try:
            self._load()
            return True
        except Exception:
            return False

    # ------------------------------------------------------------
    # 向量化
    # ------------------------------------------------------------
    @staticmethod
    def _normalize(vec: list[float]) -> list[float]:
        norm = sum(v * v for v in vec) ** 0.5
        if norm == 0:
            return [0.0] * len(vec)
        return [v / norm for v in vec]

    def embed(self, texts: list[str]) -> list[list[float]]:
        """文档向量：不带 query 前缀，批量归一化。"""
        texts = [t or "" for t in texts]
        if not texts:
            return []
        model = self._load()
        vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [self._normalize(v.tolist()) for v in vectors]

    def embed_query(self, text: str) -> list[float]:
        """查询向量：带 bge 检索前缀。"""
        model = self._load()
        vec = model.encode(
            [_QUERY_PREFIX + (text or "")],
            normalize_embeddings=True,
            show_progress_bar=False,
        )[0]
        return self._normalize(vec.tolist())
