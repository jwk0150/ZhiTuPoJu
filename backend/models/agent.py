# -*- coding: utf-8 -*-
"""Global Agent 任务 / 步骤 / 会话 ORM 模型（user_center schema，Phase 4）。

用户体系直接复用现有 JWT（user_id = username，String(64)），不建第二套用户表。
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    __table_args__ = (
        Index("idx_agent_tasks_user", "user_id"),
        Index("idx_agent_tasks_status", "status"),
        {"schema": "user_center"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[Optional[str]] = mapped_column(String(256))
    intent: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="planning")
    input: Mapped[Optional[dict]] = mapped_column(JSONB)
    plan: Mapped[Optional[list]] = mapped_column(JSONB)
    current_step: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_steps: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    error: Mapped[Optional[str]] = mapped_column(Text)
    requires_confirmation: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    confirmation_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class AgentTaskStep(Base):
    __tablename__ = "agent_task_steps"
    __table_args__ = (
        Index("idx_agent_steps_task", "task_id"),
        {"schema": "user_center"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger)
    step_index: Mapped[int] = mapped_column(Integer)
    tool_name: Mapped[Optional[str]] = mapped_column(String(128))
    tool_permission: Mapped[Optional[str]] = mapped_column(String(32))
    input: Mapped[Optional[dict]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    evidence_ids: Mapped[Optional[list]] = mapped_column(JSONB)
    error: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    requires_confirmation: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    confirmation_message: Mapped[Optional[str]] = mapped_column(Text)


class AgentConversation(Base):
    __tablename__ = "agent_conversations"
    __table_args__ = (
        Index("idx_agent_convs_user", "user_id"),
        {"schema": "user_center"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[Optional[str]] = mapped_column(String(256))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    __table_args__ = (
        Index("idx_agent_msgs_conv", "conversation_id"),
        {"schema": "user_center"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(BigInteger)
    user_id: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32))          # user / assistant / system / tool
    content: Mapped[Optional[str]] = mapped_column(Text)
    task_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    message_type: Mapped[str] = mapped_column(String(32), default="chat")
    extra: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
