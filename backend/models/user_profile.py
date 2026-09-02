# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型 —— 用户中心 user_center schema"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[Optional[str]] = mapped_column(String(128))
    school: Mapped[Optional[str]] = mapped_column(String(256))
    major: Mapped[Optional[str]] = mapped_column(String(256))
    education: Mapped[Optional[str]] = mapped_column(String(64))
    grade: Mapped[Optional[str]] = mapped_column(String(32))
    target_job: Mapped[Optional[str]] = mapped_column(String(256))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    email: Mapped[Optional[str]] = mapped_column(String(128))
    interview_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    completion: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class Resume(Base):
    __tablename__ = "resumes"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    filename: Mapped[Optional[str]] = mapped_column(String(512))
    filepath: Mapped[Optional[str]] = mapped_column(String(1024))
    file_type: Mapped[Optional[str]] = mapped_column(String(16))
    content: Mapped[Optional[str]] = mapped_column(Text)
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)
    status: Mapped[Optional[str]] = mapped_column(String(32), default="uploaded")
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    skill_name: Mapped[str] = mapped_column(String(128))
    category: Mapped[Optional[str]] = mapped_column(String(64))
    level: Mapped[Optional[str]] = mapped_column(String(32))
    score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=50)
    source: Mapped[Optional[str]] = mapped_column(String(32))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class CareerReport(Base):
    __tablename__ = "career_reports"
    __table_args__ = {"schema": "user_center"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    tech_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    project_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    data_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    engineering_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    innovation_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    learning_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    overall_score: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    advantages: Mapped[Optional[list]] = mapped_column(ARRAY(Text))
    weaknesses: Mapped[Optional[list]] = mapped_column(ARRAY(Text))
    suggestions: Mapped[Optional[list]] = mapped_column(ARRAY(Text))
    match_jobs: Mapped[Optional[dict]] = mapped_column(JSONB)
    raw_analysis: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class UserFavorite(Base):
    """用户收藏（新闻 / 发现 / 预测 / 人岗匹配统一记录）。"""
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "item_id", name="uq_user_favorite_item"),
        {"schema": "user_center"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(32))
    item_id: Mapped[str] = mapped_column(String(256))
    title: Mapped[Optional[str]] = mapped_column(String(512))
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
