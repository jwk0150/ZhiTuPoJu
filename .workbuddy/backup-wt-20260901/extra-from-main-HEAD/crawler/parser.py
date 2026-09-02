"""字段解析工具 —— 把智联原始文本清洗成结构化字段。

覆盖：SHA256、薪资、经验年限、学历、职位描述切分、福利/技能规整。
所有函数对脏数据/None 做防御，解析失败返回 None 而非抛错。
"""

from __future__ import annotations

import hashlib
import re
from typing import Iterable


def sha256(text: str | None) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


# ---------------- 薪资 ----------------
_NUM = r"(\d+(?:\.\d+)?)"


def _to_yuan(num: float, unit: str) -> int:
    """把带单位的数字换算成元/月基准值。"""
    unit = unit.lower()
    if unit in ("万", "w"):
        return int(round(num * 10000))
    if unit in ("千", "k"):
        return int(round(num * 1000))
    return int(round(num))


def parse_salary(text: str | None) -> dict:
    """解析薪资文本。

    支持：15K-25K / 1.5万-2.5万 / 8千-1.2万 / 15000-25000元/月 /
          300-500元/天 / 15K-25K·13薪 / 面议 等。

    Returns dict: salary_min, salary_max, salary_unit, salary_months, salary_description
    """
    result = {
        "salary_min": None,
        "salary_max": None,
        "salary_unit": "元/月",
        "salary_months": None,
        "salary_description": None,
    }
    if not text:
        return result
    text = text.strip()
    result["salary_description"] = text

    if any(k in text for k in ("面议", "薪资面议", "待遇面议")) or not re.search(r"\d", text):
        result["salary_unit"] = None
        return result

    # 月数：·13薪 / 13薪 / x13
    m_month = re.search(r"[·xX*]?\s*(\d{1,2})\s*薪", text)
    if m_month:
        result["salary_months"] = int(m_month.group(1))

    # 单位：天/日 → 元/天，否则默认元/月
    if re.search(r"[元]?/?[天日]", text):
        result["salary_unit"] = "元/天"
    elif re.search(r"[元]?/?小时", text):
        result["salary_unit"] = "元/时"

    # 区间 a-b，允许各自带单位（万/千/k/w）
    m = re.search(
        rf"{_NUM}\s*(万|千|[kKwW])?\s*[-~至到]\s*{_NUM}\s*(万|千|[kKwW])?",
        text,
    )
    if m:
        lo, lo_u, hi, hi_u = m.group(1), m.group(2), m.group(3), m.group(4)
        # 若低位无单位，沿用高位单位（如 "15-25K"）
        lo_unit = lo_u or hi_u or ""
        hi_unit = hi_u or ""
        result["salary_min"] = _to_yuan(float(lo), lo_unit)
        result["salary_max"] = _to_yuan(float(hi), hi_unit)
        return result

    # 单值：如 "8K"
    m1 = re.search(rf"{_NUM}\s*(万|千|[kKwW])", text)
    if m1:
        val = _to_yuan(float(m1.group(1)), m1.group(2))
        result["salary_min"] = result["salary_max"] = val
    return result


# ---------------- 经验 ----------------
def parse_experience(text: str | None) -> dict:
    """解析经验要求 → experience(原样), work_years_min, work_years_max。"""
    result = {"experience": None, "work_years_min": None, "work_years_max": None}
    if not text:
        return result
    text = text.strip()
    result["experience"] = text
    if any(k in text for k in ("不限", "无经验", "无需经验")):
        return result
    if "应届" in text or "在校" in text:
        result["work_years_min"] = result["work_years_max"] = 0
        return result
    m = re.search(rf"{_NUM}\s*[-~到]\s*{_NUM}\s*年", text)
    if m:
        result["work_years_min"] = int(float(m.group(1)))
        result["work_years_max"] = int(float(m.group(2)))
        return result
    if "以上" in text:
        m2 = re.search(rf"{_NUM}", text)
        if m2:
            result["work_years_min"] = int(float(m2.group(1)))
        return result
    if "以下" in text:
        m2 = re.search(rf"{_NUM}", text)
        if m2:
            result["work_years_min"] = 0
            result["work_years_max"] = int(float(m2.group(1)))
        return result
    m3 = re.search(rf"{_NUM}\s*年", text)
    if m3:
        y = int(float(m3.group(1)))
        result["work_years_min"] = result["work_years_max"] = y
    return result


# ---------------- 学历归一 ----------------
_EDU_ORDER = ["初中", "高中", "中专", "大专", "本科", "硕士", "博士"]


def normalize_education(text: str | None) -> str | None:
    if not text:
        return None
    text = text.strip()
    if any(k in text for k in ("不限", "无要求")):
        return "学历不限"
    for e in _EDU_ORDER:
        if e in text:
            return e
    return text


# ---------------- 职位描述切分 ----------------
_REQ_HEADERS = ("任职要求", "岗位要求", "任职资格", "职位要求", "要求", "我们希望你")


def split_description(text: str | None) -> tuple[str | None, str | None]:
    """把一段 JD 粗略切成（职位描述, 任职要求）。找不到分界则全给描述。"""
    if not text:
        return None, None
    text = text.strip()
    for h in _REQ_HEADERS:
        idx = text.find(h)
        if idx > 0:
            return text[:idx].strip() or None, text[idx:].strip() or None
    return text, None


# ---------------- 清洗集合 ----------------
def clean_list(values: Iterable | None) -> list[str]:
    """去空、去重、去两端空白，保持顺序。"""
    if not values:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if v is None:
            continue
        s = str(v).strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out
