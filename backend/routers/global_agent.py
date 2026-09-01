# -*- coding: utf-8 -*-
"""Global Agent 路由（Phase 4）。

安全约定：
- 所有端点一律依赖 get_current_user（JWT → username）。
- 前端传入的 user_id 一律不作为权限依据；Task/Conversation 归属一律以 Token 用户为准。
- Task 的 user_id 来自 JWT；绝不使用 request.user_id。

端点：
  POST /api/global-agent/context                上下文（只读）
  POST /api/global-agent/chat                   对话（兼容旧结构 + task/conversation 持久化）
  POST /api/global-agent/tasks                  创建并执行任务
  GET  /api/global-agent/tasks                  当前用户任务列表
  GET  /api/global-agent/tasks/{task_id}        任务详情（含 steps）
  POST /api/global-agent/tasks/{task_id}/confirm  HITL 确认
  POST /api/global-agent/tasks/{task_id}/cancel   取消任务
  GET  /api/global-agent/conversations          当前用户会话列表
  GET  /api/global-agent/conversations/{id}     会话详情（含 messages / related tasks）
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.agent.context import ContextBuilder
from backend.agent.event_bus import TaskEventBus
from backend.agent.executor import TaskExecutor
from backend.agent.orchestrator import classify_intent, run_agent
from backend.agent import planner
from backend.agent.task_store import TaskStore
from backend.routers.auth import get_current_user

router = APIRouter(tags=["global-agent"])


# ============================================================
# Schemas
# ============================================================
class ContextRequest(BaseModel):
    page: Optional[str] = None
    tab: Optional[str] = None
    resume_id: Optional[int] = None
    job_id: Optional[int] = None
    conversation: list[dict[str, Any]] = []


class AgentChatRequest(BaseModel):
    message: str = ""
    page: Optional[str] = None
    tab: Optional[str] = None
    resume_id: Optional[int] = None
    job_id: Optional[int] = None
    conversation: list[dict[str, Any]] = []


class TaskCreateRequest(BaseModel):
    message: str = ""
    page: Optional[str] = None
    tab: Optional[str] = None
    resume_id: Optional[int] = None
    job_id: Optional[int] = None
    conversation: list[dict[str, Any]] = []


class ConfirmRequest(BaseModel):
    approved: bool = True


def _task_input(payload) -> dict:
    return {
        "message": payload.message or "",
        "page": payload.page,
        "tab": payload.tab,
        "resume_id": payload.resume_id,
        "job_id": payload.job_id,
    }


# ============================================================
# Context / Chat
# ============================================================
@router.post("/context")
def get_agent_context(payload: ContextRequest, user: dict = Depends(get_current_user)) -> dict:
    bundle = ContextBuilder.build(
        user,
        page=payload.page, tab=payload.tab,
        resume_id=payload.resume_id, job_id=payload.job_id,
        conversation=payload.conversation or [],
    )
    return {"code": 0, "message": "success", "data": bundle}


@router.post("/chat")
def agent_chat(payload: AgentChatRequest, user: dict = Depends(get_current_user)) -> dict:
    """Global Agent 对话（兼容旧结构 + 任务/会话持久化）。

    流程：创建 Task → 持久化 user 消息 → run_agent（Orchestrator）→
          steps/messages 落库 → 返回旧字段 + task_id/conversation_id/task_status。
    """
    store = TaskStore()
    user_id = str(user.get("username") or "")
    intent = classify_intent(payload.message or "")
    plan = planner.plan_for_intent(intent, payload.message or "")
    conv = store.get_or_create_conversation(user_id, title=(payload.message or "")[:60])
    store.append_message(user_id, conv["id"], "user", payload.message or "", message_type="chat")
    task = store.create_task(
        user_id, title=(payload.message or "")[:60], intent=intent,
        input_data=_task_input(payload), plan=plan, status="running", total_steps=len(plan),
    )

    try:
        result = run_agent(
            user,
            message=payload.message or "",
            page=payload.page, tab=payload.tab,
            resume_id=payload.resume_id, job_id=payload.job_id,
            conversation=payload.conversation or [],
        )
    except Exception:
        store.update_task(task["id"], user_id, status="failed", error="内部处理异常")
        store.append_message(user_id, conv["id"], "assistant", "处理过程中出现异常，请稍后重试。",
                             task_id=task["id"], message_type="error")
        raise HTTPException(status_code=500, detail="Global Agent 处理异常")

    # 步骤 + tool 消息落库
    status_map = {"ok": "completed", "error": "failed", "blocked": "blocked"}
    tool_calls = result.get("tool_calls") or []
    for i, tc in enumerate(tool_calls):
        store.create_step(user_id, task["id"], i, tc.get("tool"), None, {"step_index": i},
                          status=status_map.get(tc.get("status"), "completed"))
        store.append_message(user_id, conv["id"], "tool",
                             f"{tc.get('tool')} {tc.get('status')}",
                             task_id=task["id"], message_type="task_progress")

    evidence_ids = [e.get("evidence_id") for e in (result.get("evidence") or []) if e.get("evidence_id")]
    store.update_task(
        task["id"], user_id, status="completed",
        current_step=len(tool_calls), total_steps=len(plan),
        result={"message": result.get("message"), "evidence_ids": evidence_ids},
        completed_at=datetime.now(),
    )
    store.append_message(user_id, conv["id"], "assistant", result.get("message") or "",
                         task_id=task["id"], message_type="task_completed",
                         extra={"intent": intent, "evidence_ids": evidence_ids})

    result["task_id"] = task["id"]
    result["conversation_id"] = conv["id"]
    result["task_status"] = "completed"
    return {"code": 0, "message": "success", "data": result}


# ============================================================
# Task API
# ============================================================
def _publish(task_id: int, event: str, data: dict) -> None:
    TaskEventBus.publish(task_id, event, data)


def _run_task_background(user: dict, task: dict, ctx: dict, conversation_id: int) -> None:
    """后台执行任务（独立线程），任务生命周期不依赖 SSE 连接。"""
    store = TaskStore()
    user_id = str(user.get("username") or "")
    try:
        emit = lambda event, data: _publish(task["id"], event, data)
        outcome = TaskExecutor().execute_task(user, task, ctx, emit=emit)
        mtype = "task_completed" if outcome["status"] == "completed" else "chat"
        store.append_message(user_id, conversation_id, "assistant",
                             outcome.get("message") or "",
                             task_id=task["id"], message_type=mtype,
                             extra={"intent": task.get("intent"), "status": outcome["status"]})
    except Exception as exc:  # noqa: BLE001
        store.update_task(task["id"], user_id, status="failed", error="后台执行异常")
        _publish(task["id"], "task.failed",
                 {"task_id": task["id"], "status": "failed", "error": "后台执行异常"})


@router.post("/tasks")
def create_task(payload: TaskCreateRequest, user: dict = Depends(get_current_user)) -> dict:
    """创建任务并在后台线程执行（非阻塞）；进度通过 GET /tasks/{id}/stream 实时获取。"""
    store = TaskStore()
    user_id = str(user.get("username") or "")
    intent = classify_intent(payload.message or "")
    plan = planner.plan_for_intent(intent, payload.message or "")
    task = store.create_task(
        user_id, title=(payload.message or "")[:60], intent=intent,
        input_data=_task_input(payload), plan=plan, status="running", total_steps=len(plan),
    )
    conv = store.get_or_create_conversation(user_id, title=(payload.message or "")[:60])
    store.append_message(user_id, conv["id"], "user", payload.message or "",
                         task_id=task["id"], message_type="chat")

    ctx = ContextBuilder.build(
        user, page=payload.page, tab=payload.tab,
        resume_id=payload.resume_id, job_id=payload.job_id,
    )
    ctx["message"] = payload.message or ""

    thread = threading.Thread(
        target=_run_task_background,
        args=(user, task, ctx, conv["id"]),
        daemon=True,
        name=f"agent-task-{task['id']}",
    )
    thread.start()

    return {"code": 0, "message": "success", "data": {
        "task_id": task["id"],
        "task": task,
        "status": "running",
        "conversation_id": conv["id"],
        "message": "任务已创建并开始执行，可通过任务流实时查看进度。",
    }}


def _sse(event: str, task_id: int, data: dict) -> str:
    payload = {"event": event, "task_id": task_id,
               "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "data": data}
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _terminal_event(task: dict) -> str:
    return {"completed": "task.completed", "failed": "task.failed",
            "cancelled": "task.cancelled"}.get(task.get("status"), "task.completed")


@router.get("/tasks/{task_id}/stream")
def stream_task(task_id: int, user: dict = Depends(get_current_user)) -> StreamingResponse:
    """SSE 实时任务流（Phase 5）。

    - 必须 JWT；user_id 来自 Token，禁止 ?user_id= 绕过。
    - 已结束任务：回放终态 + 清空队列残留后关闭。
    - 运行中任务：先发 DB 快照（断线重连可恢复），再实时推送事件。
    - 任务生命周期不依赖本连接：执行在 POST /tasks 启动的后台线程中。
    """
    store = TaskStore()
    user_id = str(user.get("username") or "")
    task = store.get_task(task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或无权限")

    terminal = ("completed", "failed", "cancelled")

    def event_stream():
        if task["status"] in terminal:
            ev = _terminal_event(task)
            data = {"task_id": task_id, "status": task["status"]}
            if task.get("error"):
                data["error"] = task["error"]
            data["result"] = task.get("result")
            yield _sse(ev, task_id, data)
            for leftover in TaskEventBus.drain(task_id):
                yield _sse(leftover["event"], task_id, leftover["data"])
            return

        # 运行中：先发快照（状态恢复），再实时推送
        yield _sse("task.started", task_id, {
            "task_id": task_id, "intent": task.get("intent"),
            "total_steps": task.get("total_steps") or 0, "status": task["status"],
        })
        steps = store.get_steps(task_id, user_id)
        for s in steps:
            st = s.get("status")
            if st == "waiting_confirmation":
                yield _sse("waiting_confirmation", task_id, {
                    "task_id": task_id, "step_index": s.get("step_index"),
                    "tool_name": s.get("tool"), "required": True,
                    "message": s.get("confirmation_message") or "是否继续？",
                })
            elif st in ("completed", "failed", "blocked"):
                yield _sse("step.completed", task_id, {
                    "step_index": s.get("step_index"), "tool_name": s.get("tool"),
                    "status": st, "evidence_ids": s.get("evidence_ids") or [],
                    "error": s.get("error"),
                })
            elif st == "running":
                yield _sse("step.started", task_id, {
                    "step_index": s.get("step_index"), "tool_name": s.get("tool"),
                    "status": "running",
                })
            else:
                yield _sse("step.started", task_id, {
                    "step_index": s.get("step_index"), "tool_name": s.get("tool"),
                    "status": "pending",
                })
        yield _sse("reasoning", task_id, {"step_index": None,
                                          "summary": "正在继续执行任务…"})

        while True:
            ev = TaskEventBus.consume(task_id, timeout=15)
            if ev is not None:
                yield _sse(ev["event"], task_id, ev["data"])
                if ev["event"] in ("task.completed", "task.failed", "task.cancelled"):
                    return
                continue
            # 心跳 + 状态检查（前端断开不影响后台执行）
            t = store.get_task(task_id, user_id)
            if not t:
                return
            if t["status"] in terminal:
                yield _sse(_terminal_event(t), task_id, {
                    "task_id": task_id, "status": t["status"],
                    "error": t.get("error"), "result": t.get("result"),
                })
                return
            yield ": keepalive\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/tasks")
def list_tasks(user: dict = Depends(get_current_user), limit: int = 20) -> dict:
    tasks = TaskStore().list_tasks(str(user.get("username") or ""), limit=min(limit, 50))
    return {"code": 0, "message": "success", "data": {"tasks": tasks}}


@router.get("/tasks/{task_id}")
def get_task(task_id: int, user: dict = Depends(get_current_user)) -> dict:
    result = TaskStore().get_task_with_steps(task_id, str(user.get("username") or ""))
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在或无权限")
    return {"code": 0, "message": "success", "data": result}


def _confirm_task_background(user: dict, task_id: int, approved: bool) -> None:
    """后台执行 HITL 确认：原子抢锁 + 从暂停步骤继续执行（emit 事件推 SSE）。"""
    store = TaskStore()
    user_id = str(user.get("username") or "")
    task = store.get_task(task_id, user_id)
    try:
        emit = lambda event, data: _publish(task_id, event, data)
        outcome = TaskExecutor().confirm_task(user, task_id, approved=approved, emit=emit)
        if outcome.get("status") in ("completed", "failed", "cancelled"):
            conv = store.get_or_create_conversation(user_id, title=(task or {}).get("title") or "AI 任务")
            store.append_message(
                user_id, conv["id"], "assistant", outcome.get("message") or "",
                task_id=task_id,
                message_type="task_completed" if outcome["status"] == "completed" else "chat",
                extra={"status": outcome["status"]},
            )
    except Exception:  # noqa: BLE001
        store.update_task(task_id, user_id, status="failed",
                          error="确认处理异常")
        _publish(task_id, "task.failed",
                 {"task_id": task_id, "status": "failed", "error": "确认处理异常"})


@router.post("/tasks/{task_id}/confirm")
def confirm_task(task_id: int, payload: ConfirmRequest, user: dict = Depends(get_current_user)) -> dict:
    """HITL 确认（非阻塞）：校验归属 + 状态，后台线程继续执行，SSE 实时推送。"""
    store = TaskStore()
    user_id = str(user.get("username") or "")
    task = store.get_task(task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或无权限")
    if task["status"] != "waiting_confirmation":
        return {"code": 0, "message": "success", "data": {
            "task_id": task_id, "status": task["status"],
            "message": "任务当前不在等待确认状态，无法重复确认。"}}
    threading.Thread(
        target=_confirm_task_background,
        args=(user, task_id, payload.approved),
        daemon=True,
        name=f"agent-confirm-{task_id}",
    ).start()
    return {"code": 0, "message": "success", "data": {
        "task_id": task_id, "status": "running",
        "message": "已受理确认，任务继续执行。"}}


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: int, user: dict = Depends(get_current_user)) -> dict:
    outcome = TaskExecutor().cancel_task(user, task_id)
    if outcome["status"] == "not_found":
        raise HTTPException(status_code=404, detail="任务不存在或无权限")
    return {"code": 0, "message": "success", "data": outcome}


# ============================================================
# Conversation API
# ============================================================
@router.get("/conversations")
def list_conversations(user: dict = Depends(get_current_user), limit: int = 20) -> dict:
    rows = TaskStore().list_conversations(str(user.get("username") or ""), limit=min(limit, 50))
    return {"code": 0, "message": "success", "data": {"conversations": rows}}


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)) -> dict:
    result = TaskStore().get_conversation(conversation_id, str(user.get("username") or ""))
    if not result:
        raise HTTPException(status_code=404, detail="会话不存在或无权限")
    return {"code": 0, "message": "success", "data": result}
