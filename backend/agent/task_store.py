# -*- coding: utf-8 -*-
"""TaskStore —— Global Agent 任务 / 步骤 / 会话持久化（Phase 4）。

安全原则：
- 所有查询/更新必须携带 user_id（来自 JWT），杜绝跨用户越权。
- 状态转换使用条件 UPDATE（原子抢锁），避免重复确认导致重复执行。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import text

from backend.db import Base, SessionLocal, engine
from backend.models.agent import AgentConversation, AgentMessage, AgentTask, AgentTaskStep

TASK_STATUSES = {"planning", "ready", "running", "waiting_confirmation", "completed", "failed", "cancelled"}
STEP_STATUSES = {"pending", "running", "completed", "failed", "blocked", "waiting_confirmation", "skipped"}

_TABLES = [AgentTask.__table__, AgentTaskStep.__table__, AgentConversation.__table__, AgentMessage.__table__]


def ensure_tables() -> None:
    """幂等创建 agent 四表（对齐 ability._ensure_tables 的惰性建表模式）。"""
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS user_center"))
    Base.metadata.create_all(bind=engine, tables=_TABLES)


def _now() -> datetime:
    return datetime.now()


def _task_to_dict(t: AgentTask) -> dict:
    return {
        "id": t.id, "user_id": t.user_id, "title": t.title, "intent": t.intent,
        "status": t.status, "input": t.input, "plan": t.plan,
        "current_step": t.current_step or 0, "total_steps": t.total_steps or 0,
        "result": t.result, "error": t.error,
        "requires_confirmation": bool(t.requires_confirmation),
        "confirmation_message": t.confirmation_message,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


def _step_to_dict(s: AgentTaskStep) -> dict:
    return {
        "id": s.id, "task_id": s.task_id, "step_index": s.step_index,
        "tool": s.tool_name, "permission": s.tool_permission,
        "status": s.status, "input": s.input, "result": s.result,
        "evidence_ids": s.evidence_ids or [], "error": s.error,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "requires_confirmation": bool(s.requires_confirmation),
        "confirmation_message": s.confirmation_message,
    }


class TaskStore:
    def __init__(self) -> None:
        ensure_tables()

    # ---------------- Task ----------------
    def create_task(self, user_id: str, *, title: str = "", intent: str = "",
                    input_data: Optional[dict] = None, plan: Optional[list] = None,
                    status: str = "planning", total_steps: int = 0) -> dict:
        now = _now()
        db = SessionLocal()
        try:
            task = AgentTask(user_id=user_id, title=(title or "")[:256], intent=intent[:64],
                             status=status, input=input_data or {}, plan=plan or [],
                             current_step=0, total_steps=total_steps,
                             requires_confirmation=False, created_at=now, updated_at=now)
            db.add(task)
            db.commit()
            db.refresh(task)
            return _task_to_dict(task)
        finally:
            db.close()

    def get_task(self, task_id: int, user_id: str) -> Optional[dict]:
        db = SessionLocal()
        try:
            task = (db.query(AgentTask)
                    .filter(AgentTask.id == task_id, AgentTask.user_id == user_id)
                    .first())
            return _task_to_dict(task) if task else None
        finally:
            db.close()

    def list_tasks(self, user_id: str, limit: int = 20) -> list[dict]:
        db = SessionLocal()
        try:
            rows = (db.query(AgentTask)
                    .filter(AgentTask.user_id == user_id)
                    .order_by(AgentTask.id.desc())
                    .limit(limit)
                    .all())
            return [_task_to_dict(t) for t in rows]
        finally:
            db.close()

    def update_task(self, task_id: int, user_id: str, **fields: Any) -> Optional[dict]:
        allowed = {"title", "intent", "status", "input", "plan", "current_step",
                   "total_steps", "result", "error", "requires_confirmation",
                   "confirmation_message", "completed_at"}
        data = {k: v for k, v in fields.items() if k in allowed}
        if not data:
            return self.get_task(task_id, user_id)
        data["updated_at"] = _now()
        db = SessionLocal()
        try:
            updated = (db.query(AgentTask)
                       .filter(AgentTask.id == task_id, AgentTask.user_id == user_id)
                       .update(data, synchronize_session=False))
            db.commit()
            if not updated:
                return None
        finally:
            db.close()
        return self.get_task(task_id, user_id)

    def transition_status(self, task_id: int, user_id: str, from_status: str,
                          to_status: str) -> bool:
        """原子状态转换（条件 UPDATE，抢锁失败返回 False，防重复确认）。"""
        db = SessionLocal()
        try:
            updated = (db.query(AgentTask)
                       .filter(AgentTask.id == task_id, AgentTask.user_id == user_id,
                               AgentTask.status == from_status)
                       .update({"status": to_status, "updated_at": _now()},
                               synchronize_session=False))
            db.commit()
            return bool(updated)
        finally:
            db.close()

    def get_task_with_steps(self, task_id: int, user_id: str) -> Optional[dict]:
        task = self.get_task(task_id, user_id)
        if not task:
            return None
        return {"task": task, "steps": self.get_steps(task_id, user_id),
                "status": task["status"]}

    # ---------------- Steps ----------------
    def create_step(self, user_id: str, task_id: int, step_index: int, tool_name: str,
                    permission: Optional[str] = None, input_data: Optional[dict] = None,
                    status: str = "pending", requires_confirmation: bool = False,
                    confirmation_message: Optional[str] = None,
                    error: Optional[str] = None) -> Optional[dict]:
        if not self.get_task(task_id, user_id):
            return None
        db = SessionLocal()
        try:
            step = AgentTaskStep(task_id=task_id, step_index=step_index,
                                 tool_name=tool_name, tool_permission=permission,
                                 input=input_data or {}, status=status,
                                 requires_confirmation=requires_confirmation,
                                 confirmation_message=confirmation_message,
                                 error=error,
                                 started_at=_now() if status in ("running", "waiting_confirmation") else None)
            db.add(step)
            db.commit()
            db.refresh(step)
            return _step_to_dict(step)
        finally:
            db.close()

    def get_steps(self, task_id: int, user_id: str) -> list[dict]:
        if not self.get_task(task_id, user_id):
            return []
        db = SessionLocal()
        try:
            rows = (db.query(AgentTaskStep)
                    .filter(AgentTaskStep.task_id == task_id)
                    .order_by(AgentTaskStep.step_index.asc(), AgentTaskStep.id.asc())
                    .all())
            return [_step_to_dict(s) for s in rows]
        finally:
            db.close()

    def update_step(self, task_id: int, user_id: str, step_index: int, **fields: Any) -> Optional[dict]:
        allowed = {"status", "result", "evidence_ids", "error", "started_at", "completed_at",
                   "requires_confirmation", "confirmation_message"}
        data = {k: v for k, v in fields.items() if k in allowed}
        if not data:
            return None
        db = SessionLocal()
        try:
            task = (db.query(AgentTask)
                    .filter(AgentTask.id == task_id, AgentTask.user_id == user_id)
                    .first())
            if not task:
                return None
            updated = (db.query(AgentTaskStep)
                       .filter(AgentTaskStep.task_id == task_id,
                               AgentTaskStep.step_index == step_index)
                       .update(data, synchronize_session=False))
            db.commit()
            if not updated:
                return None
        finally:
            db.close()
        for s in self.get_steps(task_id, user_id):
            if s["step_index"] == step_index:
                return s
        return None

    # ---------------- Conversation / Messages ----------------
    def get_or_create_conversation(self, user_id: str, title: str = "") -> dict:
        db = SessionLocal()
        try:
            conv = (db.query(AgentConversation)
                    .filter(AgentConversation.user_id == user_id)
                    .order_by(AgentConversation.id.desc())
                    .first())
            if conv:
                conv.updated_at = _now()
                db.commit()
                db.refresh(conv)
                return {"id": conv.id, "user_id": conv.user_id, "title": conv.title,
                        "created_at": conv.created_at.isoformat() if conv.created_at else None,
                        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None}
            conv = AgentConversation(user_id=user_id, title=(title or "Global AI 对话")[:256],
                                     created_at=_now(), updated_at=_now())
            db.add(conv)
            db.commit()
            db.refresh(conv)
            return {"id": conv.id, "user_id": conv.user_id, "title": conv.title,
                    "created_at": conv.created_at.isoformat() if conv.created_at else None,
                    "updated_at": conv.updated_at.isoformat() if conv.updated_at else None}
        finally:
            db.close()

    def create_conversation(self, user_id: str, title: str = "") -> dict:
        db = SessionLocal()
        try:
            conv = AgentConversation(user_id=user_id, title=(title or "Global AI 对话")[:256],
                                     created_at=_now(), updated_at=_now())
            db.add(conv)
            db.commit()
            db.refresh(conv)
            return {"id": conv.id, "user_id": conv.user_id, "title": conv.title,
                    "created_at": conv.created_at.isoformat() if conv.created_at else None,
                    "updated_at": conv.updated_at.isoformat() if conv.updated_at else None}
        finally:
            db.close()

    def get_conversation(self, conversation_id: int, user_id: str) -> Optional[dict]:
        db = SessionLocal()
        try:
            conv = (db.query(AgentConversation)
                    .filter(AgentConversation.id == conversation_id,
                            AgentConversation.user_id == user_id)
                    .first())
            if not conv:
                return None
            messages = (db.query(AgentMessage)
                        .filter(AgentMessage.conversation_id == conversation_id,
                                AgentMessage.user_id == user_id)
                        .order_by(AgentMessage.id.asc())
                        .all())
            recent_tasks = (db.query(AgentTask)
                            .filter(AgentTask.user_id == user_id)
                            .order_by(AgentTask.id.desc())
                            .limit(5)
                            .all())
            return {
                "conversation": {
                    "id": conv.id, "user_id": conv.user_id, "title": conv.title,
                    "created_at": conv.created_at.isoformat() if conv.created_at else None,
                    "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                },
                "messages": [self._msg_to_dict(m) for m in messages],
                "related_tasks": [_task_to_dict(t) for t in recent_tasks],
            }
        finally:
            db.close()

    def list_conversations(self, user_id: str, limit: int = 20) -> list[dict]:
        db = SessionLocal()
        try:
            rows = (db.query(AgentConversation)
                    .filter(AgentConversation.user_id == user_id)
                    .order_by(AgentConversation.id.desc())
                    .limit(limit)
                    .all())
            return [{"id": c.id, "user_id": c.user_id, "title": c.title,
                     "created_at": c.created_at.isoformat() if c.created_at else None,
                     "updated_at": c.updated_at.isoformat() if c.updated_at else None}
                    for c in rows]
        finally:
            db.close()

    def append_message(self, user_id: str, conversation_id: int, role: str, content: str,
                       task_id: Optional[int] = None, message_type: str = "chat",
                       extra: Optional[dict] = None) -> Optional[dict]:
        if role not in ("user", "assistant", "system", "tool"):
            role = "chat"
        if message_type not in ("chat", "task_started", "task_progress", "task_completed",
                                "confirmation_required", "error"):
            message_type = "chat"
        db = SessionLocal()
        try:
            conv = (db.query(AgentConversation)
                    .filter(AgentConversation.id == conversation_id,
                            AgentConversation.user_id == user_id)
                    .first())
            if not conv:
                return None
            msg = AgentMessage(conversation_id=conversation_id, user_id=user_id, role=role,
                               content=(content or "")[:8000], task_id=task_id,
                               message_type=message_type, extra=extra or {}, created_at=_now())
            db.add(msg)
            conv.updated_at = _now()
            db.commit()
            db.refresh(msg)
            return self._msg_to_dict(msg)
        finally:
            db.close()

    @staticmethod
    def _msg_to_dict(m: AgentMessage) -> dict:
        return {
            "id": m.id, "conversation_id": m.conversation_id, "user_id": m.user_id,
            "role": m.role, "content": m.content, "task_id": m.task_id,
            "message_type": m.message_type, "extra": m.extra,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
