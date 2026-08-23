# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型 —— 映射 PostgreSQL 已有表"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


class JobPosting(Base):
    # 数据源已切换:通过 the_total_table 视图访问 the_total_table_copy1(38780 条)
    __tablename__ = "the_total_table"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[Optional[str]] = mapped_column(String(64))
    source_id_hash: Mapped[str] = mapped_column(String(64))
    job_title: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(64))
    district: Mapped[Optional[str]] = mapped_column(String(64))
    salary_min: Mapped[Optional[int]] = mapped_column(Integer)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer)
    salary_unit: Mapped[Optional[str]] = mapped_column(String(16))
    experience: Mapped[Optional[str]] = mapped_column(String(32))
    education: Mapped[Optional[str]] = mapped_column(String(32))
    job_type: Mapped[Optional[str]] = mapped_column(String(32))
    publish_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    crawl_time: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[int] = mapped_column(SmallInteger)
    fingerprint: Mapped[Optional[str]] = mapped_column(String(64))
    completeness: Mapped[Optional[int]] = mapped_column(SmallInteger)


class JobPostingDetail(Base):
    __tablename__ = "job_posting_details"

    detail_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(BigInteger)
    company_industry: Mapped[Optional[str]] = mapped_column(String(128))
    company_size: Mapped[Optional[str]] = mapped_column(String(64))
    company_nature: Mapped[Optional[str]] = mapped_column(String(64))
    company_intro: Mapped[Optional[str]] = mapped_column(Text)
    company_address: Mapped[Optional[str]] = mapped_column(String(512))
    company_logo: Mapped[Optional[str]] = mapped_column(String(512))
    job_description: Mapped[Optional[str]] = mapped_column(Text)
    job_requirement: Mapped[Optional[str]] = mapped_column(Text)
    job_highlights: Mapped[Optional[str]] = mapped_column(Text)
    job_labels: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    skills: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    benefits: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    keywords: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    work_years_min: Mapped[Optional[int]] = mapped_column(Integer)
    work_years_max: Mapped[Optional[int]] = mapped_column(Integer)
    education_required: Mapped[Optional[str]] = mapped_column(String(32))
    major_required: Mapped[Optional[str]] = mapped_column(String(128))
    language_required: Mapped[Optional[str]] = mapped_column(String(64))
    certificate_required: Mapped[Optional[str]] = mapped_column(String(128))
    salary_description: Mapped[Optional[str]] = mapped_column(String(128))
    salary_months: Mapped[Optional[int]] = mapped_column(SmallInteger)
    salary_currency: Mapped[Optional[str]] = mapped_column(String(16))
    work_mode: Mapped[Optional[str]] = mapped_column(String(32))
    work_schedule: Mapped[Optional[str]] = mapped_column(String(64))
    overtime_status: Mapped[Optional[str]] = mapped_column(String(32))
    travel_status: Mapped[Optional[str]] = mapped_column(String(32))
    headcount: Mapped[Optional[int]] = mapped_column(Integer)
    deadline: Mapped[Optional[date]] = mapped_column(Date)
    publisher_name: Mapped[Optional[str]] = mapped_column(String(64))
    publisher_title: Mapped[Optional[str]] = mapped_column(String(64))
    publisher_avatar: Mapped[Optional[str]] = mapped_column(String(512))
    response_rate: Mapped[Optional[str]] = mapped_column(String(16))
    response_time: Mapped[Optional[str]] = mapped_column(String(16))
    online_status: Mapped[Optional[str]] = mapped_column(String(16))
    last_active_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    source_url: Mapped[Optional[str]] = mapped_column(String(1024))
    extra: Mapped[Optional[dict]] = mapped_column(JSONB)
    raw_html: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class LiepinJob(Base):
    __tablename__ = "liepin_jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(64))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    salary: Mapped[Optional[str]] = mapped_column(String(64))
    salary_low_k: Mapped[Optional[float]] = mapped_column()
    salary_high_k: Mapped[Optional[float]] = mapped_column()
    salary_unit: Mapped[Optional[str]] = mapped_column(String(16))
    location: Mapped[Optional[str]] = mapped_column(String(128))
    location_city: Mapped[Optional[str]] = mapped_column(String(64))
    location_district: Mapped[Optional[str]] = mapped_column(String(64))
    tags: Mapped[Optional[str]] = mapped_column(Text)
    experience: Mapped[Optional[str]] = mapped_column(String(32))
    education: Mapped[Optional[str]] = mapped_column(String(32))
    company: Mapped[Optional[str]] = mapped_column(String(255))
    company_scale: Mapped[Optional[str]] = mapped_column(String(64))
    company_stage: Mapped[Optional[str]] = mapped_column(String(64))
    company_industry: Mapped[Optional[str]] = mapped_column(String(128))
    hr_name: Mapped[Optional[str]] = mapped_column(String(64))
    hr_active: Mapped[Optional[str]] = mapped_column(String(16))
    recruit_type: Mapped[Optional[str]] = mapped_column(String(32))
    welfare: Mapped[Optional[str]] = mapped_column(Text)
    job_link: Mapped[Optional[str]] = mapped_column(String(512))
    publish_time: Mapped[Optional[str]] = mapped_column(String(64))
    search_keyword: Mapped[Optional[str]] = mapped_column(String(64))
    search_city: Mapped[Optional[str]] = mapped_column(String(64))
    salary_source: Mapped[Optional[str]] = mapped_column(String(16))
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
