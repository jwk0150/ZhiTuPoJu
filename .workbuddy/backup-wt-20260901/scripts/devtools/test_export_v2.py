#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v2 导出包单元测试（无需数据库）。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from crawler.exchange.common import (  # noqa: E402
    MasterIdGenerator,
    build_unified_record,
    dumps_json_line,
    validate_master_id,
)


def test_master_id_format() -> None:
    gen = MasterIdGenerator("202609", start=1)
    mid = gen.next_id()
    assert mid == "20260900001", mid
    assert validate_master_id(mid)
    mid2 = gen.next_id()
    assert mid2 == "20260900002", mid2


def test_utf8_json() -> None:
    rec = {"job_title": "大模型微调工程师", "city": "北京", "skills": ["Python", "PyTorch"]}
    line = dumps_json_line(rec)
    assert "\\u" not in line
    parsed = json.loads(line.strip())
    assert parsed["job_title"] == "大模型微调工程师"


def test_unified_link() -> None:
    posting = {
        "source_name": "zhilian",
        "source_id": "123",
        "source_id_hash": "abc",
        "job_title": "AI Agent 架构师",
        "master_id": "20260900001",
    }
    detail = {
        "master_id": "20260900001",
        "company_logo": "zhilian_crawl_2026-08-24_media/20260900001_company_logo.jpg",
        "job_description": "负责 Agent 系统设计",
    }
    unified = build_unified_record("20260900001", posting, detail)
    assert unified["master_id"] == "20260900001"
    assert unified["_link"]["foreign_key"] == "master_id"
    assert unified["company_logo"].startswith("zhilian_crawl")
    assert unified["job_title"] == "AI Agent 架构师"


def main() -> int:
    test_master_id_format()
    test_utf8_json()
    test_unified_link()
    print("PASS: export v2 common tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
