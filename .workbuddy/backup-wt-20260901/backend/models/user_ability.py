# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型 —— 我的能力（user_center schema）

TechAbility : 系统技术能力主表（由岗位真实技术数据聚合生成，供用户能力统一关联）
UserAbility : 用户已选能力关联表（user_id -> tech_abilities.id）

关系：User -> UserAbility -> TechAbility（系统已有技术体系）
为后续"岗位要求 -> 能力匹配 -> 能力差距"预留数据结构。
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Column, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


class TechAbility(Base):
    __tablename__ = "tech_abilities"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    category: Mapped[Optional[str]] = mapped_column(String(64))
    frequency: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class UserAbility(Base):
    __tablename__ = "user_abilities"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    ability_id: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
