"""岗位数据模型 —— 对齐 DDL 两张表。

``JobItem`` 承载一条岗位的全部字段（总表 + 细节表），
DB 层负责拆分成 job_postings / job_posting_details 两次写入。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


@dataclass
class JobItem:
    # ===== job_postings（总表）=====
    source_name: str = "zhilian"
    source_id: str | None = None
    source_id_hash: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    city: str | None = None
    district: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_unit: str | None = "元/月"
    experience: str | None = None
    education: str | None = None
    job_type: str | None = None
    publish_time: datetime | None = None
    status: int = 0

    # ===== job_posting_details（细节表）=====
    company_industry: str | None = None
    company_size: str | None = None
    company_nature: str | None = None
    company_intro: str | None = None
    company_address: str | None = None
    company_logo: str | None = None
    job_description: str | None = None
    job_requirement: str | None = None
    job_highlights: str | None = None
    job_labels: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    benefits: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    work_years_min: int | None = None
    work_years_max: int | None = None
    education_required: str | None = None
    major_required: str | None = None
    language_required: str | None = None
    certificate_required: str | None = None
    salary_description: str | None = None
    salary_months: int | None = None
    salary_currency: str | None = "CNY"
    job_category_l1: str | None = None
    job_category_l2: str | None = None
    job_category_l3: str | None = None
    work_mode: str | None = None
    work_schedule: str | None = None
    overtime_status: str | None = None
    travel_status: str | None = None
    headcount: int | None = None
    deadline: date | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    contact_wechat: str | None = None
    resume_receive_email: str | None = None
    publisher_name: str | None = None
    publisher_title: str | None = None
    publisher_avatar: str | None = None
    response_rate: str | None = None
    response_time: str | None = None
    online_status: str | None = None
    last_active_time: datetime | None = None
    interview_count: int | None = None
    hire_count: int | None = None
    view_count: int | None = None
    apply_count: int | None = None
    favor_count: int | None = None
    source_url: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    raw_html: str | None = None

    # ---- 拆分给两张表 ----
    POSTING_FIELDS = (
        "source_name", "source_id", "source_id_hash", "job_title", "company_name",
        "city", "district", "salary_min", "salary_max", "salary_unit",
        "experience", "education", "job_type", "publish_time", "status",
    )
    DETAIL_FIELDS = (
        "company_industry", "company_size", "company_nature", "company_intro",
        "company_address", "company_logo", "job_description", "job_requirement",
        "job_highlights", "job_labels", "skills", "benefits", "keywords",
        "work_years_min", "work_years_max", "education_required", "major_required",
        "language_required", "certificate_required", "salary_description",
        "salary_months", "salary_currency", "job_category_l1", "job_category_l2",
        "job_category_l3", "work_mode", "work_schedule", "overtime_status",
        "travel_status", "headcount", "deadline", "contact_name", "contact_phone",
        "contact_email", "contact_wechat", "resume_receive_email", "publisher_name",
        "publisher_title", "publisher_avatar", "response_rate", "response_time",
        "online_status", "last_active_time", "interview_count", "hire_count",
        "view_count", "apply_count", "favor_count", "source_url", "extra", "raw_html",
    )

    def posting_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in self.POSTING_FIELDS}

    def detail_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in self.DETAIL_FIELDS}
