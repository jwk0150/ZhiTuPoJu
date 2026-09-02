import json
from unittest.mock import MagicMock, patch

from backend.llm import deepseek


def test_is_configured_false_without_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    assert deepseek.is_configured() is False


def test_is_configured_true_with_key(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    assert deepseek.is_configured() is True


def test_enrich_skips_when_no_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    jobs = [{"id": "d1", "title": "Agent工程师", "definition": "old", "core_skills": ["Python"]}]
    out, meta = deepseek.enrich_discoveries(jobs, top_n=8)
    assert out[0]["definition"] == "old"
    assert meta["llm"] == "none"
    assert meta["enriched"] == 0


def test_enrich_rewrites_top_n(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    payload = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "items": [{
                        "id": "d1",
                        "definition": "负责多智能体任务规划与工具编排。",
                        "reasoning": "标题含Agent且技能组合新颖。"
                    }]
                }, ensure_ascii=False)
            }
        }]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload
    mock_resp.raise_for_status = MagicMock()

    jobs = [
        {"id": "d1", "title": "Agent工程师", "definition": "raw", "core_skills": ["Agent"], "responsibilities": []},
        {"id": "d2", "title": "Java", "definition": "raw2", "core_skills": ["Java"], "responsibilities": []},
    ]
    with patch("backend.llm.deepseek.httpx.Client") as client_cls:
        client_cls.return_value.__enter__.return_value.post.return_value = mock_resp
        out, meta = deepseek.enrich_discoveries(jobs, top_n=1)
    assert out[0]["definition"].startswith("负责多")
    assert "Agent" in out[0]["reasoning"]
    assert out[1]["definition"] == "raw2"
    assert meta["llm"] == "deepseek-chat"
    assert meta["enriched"] == 1
