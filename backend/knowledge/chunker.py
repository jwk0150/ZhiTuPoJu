# -*- coding: utf-8 -*-
"""JD 切块 —— 优先按语义 section，无结构时 fallback 固定窗口。

每个 chunk：
- chunk_text      : 文本
- section         : overview/duty/requirement/bonus/benefit/highlight/company/skills
- token_estimate  : 估算 token 数（信息性）
- text_hash       : sha256(chunk_text)（去重）
"""
from __future__ import annotations

from crawler.parser import sha256

MAX_CHARS = 500          # 单块上限字符
OVERLAP = 50             # 长文本硬切时的重叠字符
MIN_CHARS = 20           # 过短片段直接丢弃


def _split_long(text: str, max_chars: int = MAX_CHARS, overlap: int = OVERLAP) -> list[str]:
    """长文本切块：先按段落聚合，段落仍过长则按窗口硬切。"""
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for para in paragraphs:
        if len(para) > max_chars:
            if buf:
                chunks.append(buf)
                buf = ""
            # 硬切长段落
            start = 0
            while start < len(para):
                end = min(start + max_chars, len(para))
                chunks.append(para[start:end].strip())
                start = end - overlap
        else:
            if buf and len(buf) + len(para) + 1 > max_chars:
                chunks.append(buf)
                # 保留上一块尾部作为下一块前缀，形成轻量 overlap
                buf = (buf[-overlap:] + "\n" + para).strip() if overlap else para
            else:
                buf = f"{buf}\n{para}".strip()
    if buf:
        chunks.append(buf)
    return [c for c in chunks if c]


def build_chunks(document: dict) -> list[dict]:
    """按 section 生成 chunk 列表。

    document 为 cleaner.clean_job() 的输出：
    {"sections": [...], "skills": [...], "title": ...}
    """
    chunks: list[dict] = []

    for sec in document.get("sections") or []:
        section_name = sec.get("section", "overview")
        text = (sec.get("text") or "").strip()
        if not text or len(text) < MIN_CHARS:
            continue
        if len(text) <= MAX_CHARS:
            chunks.append({
                "section": section_name,
                "chunk_text": text,
                "token_estimate": max(1, len(text) // 2),
                "text_hash": sha256(text),
            })
        else:
            for part in _split_long(text):
                if len(part) < MIN_CHARS:
                    continue
                chunks.append({
                    "section": section_name,
                    "chunk_text": part,
                    "token_estimate": max(1, len(part) // 2),
                    "text_hash": sha256(part),
                })

    # 技能标签合成块（结构化技能 → 语义可检索）
    skills = document.get("skills") or []
    if skills:
        skill_text = "技能要求：" + "、".join(skills)
        chunks.append({
            "section": "skills",
            "chunk_text": skill_text,
            "token_estimate": max(1, len(skill_text) // 2),
            "text_hash": sha256(skill_text),
        })

    # 无任何 section 文本的极端兜底：整段原文
    if not chunks and (document.get("raw_text") or "").strip():
        text = document["raw_text"].strip()
        for part in _split_long(text):
            chunks.append({
                "section": "overview",
                "chunk_text": part,
                "token_estimate": max(1, len(part) // 2),
                "text_hash": sha256(part),
            })

    return chunks
