# -*- coding: utf-8 -*-
from backend.llm import zhitu_agent


def test_detect_intents_procure():
    assert "procure" in zhitu_agent.detect_intents("本轮优先采购哪些岗位")


def test_detect_intents_forecast():
    assert "forecast" in zhitu_agent.detect_intents("预测岗位要不要跟踪")


def test_load_knowledge_has_playbook():
    kb = zhitu_agent.load_knowledge()
    assert "发现" in (kb.get("playbook") or "")
    assert isinstance(kb.get("cards"), list) and len(kb["cards"]) >= 3
    assert isinstance(kb.get("examples"), list) and len(kb["examples"]) >= 3


def test_basic_time_skill():
    out = zhitu_agent.chat(message="现在几点了", channel="qa", discoveries=[], forecasts=[])
    assert out["mode"] == "basic"
    assert "现在是" in out["reply"] or "年" in out["reply"]


def test_basic_greeting():
    out = zhitu_agent.chat(message="你好", channel="suggest", discoveries=[], forecasts=[])
    assert out["mode"] == "basic"
    assert "扫描" not in out["reply"] or "执图" in out["reply"]


def test_chat_heuristic_empty_does_not_invent_job(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setattr(zhitu_agent, "retrieve_jd_signals", lambda *a, **k: [])
    out = zhitu_agent.chat(
        message="帮我采购量子波动速记工程师",
        channel="suggest",
        discoveries=[],
        forecasts=[],
    )
    assert out["mode"] in ("heuristic", "basic")
    assert "量子波动速记工程师" not in out["reply"]
    assert ("扫" in out["reply"]) or ("采购" in out["reply"])


def test_chat_heuristic_with_pending(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setattr(zhitu_agent, "retrieve_jd_signals", lambda *a, **k: [])
    jobs = [{
        "id": "d1",
        "title": "RAG 工程师",
        "status": "pending",
        "confidence": 88,
        "core_skills": ["RAG", "Python"],
    }]
    out = zhitu_agent.chat(
        message="优先采谁",
        channel="suggest",
        discoveries=jobs,
        forecasts=[],
    )
    assert out["mode"] == "heuristic"
    assert "RAG 工程师" in out["reply"]
    assert out["recommendations"][0]["id"] == "d1"


def test_suggest_procurement_delegates(monkeypatch):
    from backend.llm import deepseek

    monkeypatch.setattr(
        zhitu_agent,
        "chat",
        lambda **kwargs: {
            "reply": "delegated",
            "recommendations": [],
            "llm": "none",
            "error": None,
            "mode": "heuristic",
            "channel": kwargs.get("channel"),
        },
    )
    out = deepseek.suggest_procurement_chat("hi", discoveries=[], forecasts=[])
    assert out["reply"] == "delegated"
