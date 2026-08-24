# -*- coding: utf-8 -*-
"""我的能力 — FastAPI Router

提供：
  1. 全量技术目录（GET /api/ability/catalog）
     从系统真实岗位技术数据（the_total_table.skills）聚合，按统一分类组织，
     并落库到 user_center.tech_abilities（技术主表，id 稳定）。
  2. 用户能力读取/保存（GET/POST /api/ability/{username}）
     用户问卷结果保存到 user_center.user_abilities（user_id -> tech_abilities.id），
     全量替换、事务保证一致性。

关系：User -> UserAbility -> TechAbility（与岗位技术图谱共用同一技术体系）
"""
from __future__ import annotations

import time
from collections import Counter
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from backend.db import SessionLocal

router = APIRouter(tags=["ability"])

# 技术目录缓存（TTL 5 分钟，避免每次打开都全表聚合）
_catalog_cache: dict = {"ts": 0.0, "data": None}
_CATALOG_TTL = 300.0
_TOP_N_PER_CATEGORY = 18

# 分类展示顺序（与前端 TECH_CATEGORY_COLORS 对齐；未命中映射的技术归入兜底分类）
_CATEGORY_ORDER = [
    "编程语言", "框架与开发", "数据存储与处理", "工程化与运维",
    "AI与算法", "前端技术", "架构设计", "后端技术",
    "数据处理", "测试技术", "嵌入式/硬件", "核心技能",
]

_tables_ready = False


def _ensure_tables() -> None:
    """幂等确保 user_center 技术主表与用户能力关联表存在"""
    global _tables_ready
    if _tables_ready:
        return
    db = SessionLocal()
    try:
        db.execute(text("CREATE SCHEMA IF NOT EXISTS user_center"))
        db.execute(text(
            "CREATE TABLE IF NOT EXISTS user_center.tech_abilities ("
            " id SERIAL PRIMARY KEY,"
            " name VARCHAR(128) NOT NULL UNIQUE,"
            " category VARCHAR(64),"
            " frequency INTEGER NOT NULL DEFAULT 0,"
            " sort_order INTEGER NOT NULL DEFAULT 0,"
            " created_at TIMESTAMPTZ DEFAULT now(),"
            " updated_at TIMESTAMPTZ DEFAULT now())"
        ))
        db.execute(text(
            "CREATE TABLE IF NOT EXISTS user_center.user_abilities ("
            " id SERIAL PRIMARY KEY,"
            " user_id VARCHAR(64) NOT NULL,"
            " ability_id BIGINT NOT NULL REFERENCES user_center.tech_abilities(id) ON DELETE CASCADE,"
            " created_at TIMESTAMPTZ DEFAULT now(),"
            " updated_at TIMESTAMPTZ DEFAULT now())"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_user_abilities_user"
            " ON user_center.user_abilities(user_id)"
        ))
        db.commit()
        _tables_ready = True
    finally:
        db.close()


def _aggregate_skills() -> Counter:
    """从 the_total_table 全量聚合岗位技能（数据库端 unnest 展开逗号分隔字段）"""
    db = SessionLocal()
    try:
        rows = db.execute(text(
            "SELECT trim(skill) AS name, count(*) AS cnt"
            " FROM (SELECT unnest(string_to_array(skills, ',')) AS skill"
            "       FROM the_total_table"
            "       WHERE skills IS NOT NULL AND skills <> '') t"
            " WHERE trim(skill) <> ''"
            " GROUP BY trim(skill)"
        )).fetchall()
    finally:
        db.close()
    return Counter({r[0]: r[1] for r in rows})


def _load_tech_catalog(force: bool = False) -> dict:
    """聚合真实技术目录：按分类组织，每类 TOP N，并为技术分配稳定 id"""
    global _catalog_cache
    now = time.time()
    if not force and _catalog_cache["data"] is not None and now - _catalog_cache["ts"] < _CATALOG_TTL:
        return _catalog_cache["data"]

    _ensure_tables()
    counter = _aggregate_skills()
    if not counter:
        return {"categories": [], "total": 0, "maxFrequency": 1}

    from backend.services import _classify_job_tech

    # upsert 到技术主表（name 唯一；已有 id 保持不变，新技能自动入库）
    db = SessionLocal()
    try:
        for name, freq in counter.items():
            cat = _classify_job_tech(name)
            db.execute(text(
                "INSERT INTO user_center.tech_abilities (name, category, frequency, sort_order, created_at, updated_at)"
                " VALUES (:name, :cat, :freq, 0, now(), now())"
                " ON CONFLICT (name) DO UPDATE SET"
                "   category = EXCLUDED.category, frequency = EXCLUDED.frequency, updated_at = now()"
            ), {"name": name, "cat": cat, "freq": freq})
        db.commit()
    finally:
        db.close()

    # 按分类组织
    by_cat: dict = {}
    for name, freq in counter.items():
        by_cat.setdefault(_classify_job_tech(name), []).append((name, freq))

    categories = []
    used_cats = set()
    for cat in _CATEGORY_ORDER:
        items = by_cat.get(cat)
        if not items:
            continue
        used_cats.add(cat)
        items.sort(key=lambda x: -x[1])
        categories.append({
            "name": cat, "type": "category",
            "technologies": [{"name": n, "frequency": f} for n, f in items[:_TOP_N_PER_CATEGORY]],
        })
    for cat, items in by_cat.items():
        if cat in used_cats:
            continue
        items.sort(key=lambda x: -x[1])
        categories.append({
            "name": cat, "type": "category",
            "technologies": [{"name": n, "frequency": f} for n, f in items[:_TOP_N_PER_CATEGORY]],
        })

    # 为技术补充稳定 id
    db = SessionLocal()
    try:
        id_map = {r[1]: r[0] for r in db.execute(text("SELECT id, name FROM user_center.tech_abilities")).fetchall()}
    finally:
        db.close()

    total = 0
    max_freq = 1
    for cat in categories:
        for t in cat["technologies"]:
            t["id"] = id_map.get(t["name"])
            total += 1
            max_freq = max(max_freq, t["frequency"])

    data = {"categories": categories, "total": total, "maxFrequency": max_freq}
    _catalog_cache = {"ts": now, "data": data}
    return data


def _read_user_abilities(username: str) -> list:
    db = SessionLocal()
    try:
        rows = db.execute(text(
            "SELECT ta.id, ta.name, ta.category, ta.frequency"
            " FROM user_center.user_abilities ua"
            " JOIN user_center.tech_abilities ta ON ta.id = ua.ability_id"
            " WHERE ua.user_id = :u"
            " ORDER BY ta.frequency DESC, ta.id ASC"
        ), {"u": username}).fetchall()
        return [{"id": r[0], "name": r[1], "category": r[2], "frequency": r[3]} for r in rows]
    finally:
        db.close()


class AbilitySaveRequest(BaseModel):
    abilityIds: List[int] = []


@router.get("/catalog")
def get_ability_catalog():
    """全量技术能力目录（系统真实技术，按分类组织）"""
    try:
        return {"code": 0, "message": "success", "data": _load_tech_catalog()}
    except Exception as exc:
        return {"code": 1, "message": f"技术目录加载失败: {exc}", "data": None}


@router.get("/{username}")
def get_user_abilities(username: str):
    """获取指定用户已保存的能力（filled 用于判断是否已填写问卷）"""
    try:
        _ensure_tables()
        abilities = _read_user_abilities(username)
        return {"code": 0, "message": "success", "data": {"filled": bool(abilities), "abilities": abilities}}
    except Exception as exc:
        return {"code": 1, "message": f"能力数据加载失败: {exc}", "data": None}


@router.post("/{username}")
def save_user_abilities(username: str, payload: AbilitySaveRequest):
    """保存用户能力（全量替换：先删后插，事务保证一致性）"""
    try:
        _ensure_tables()
        db = SessionLocal()
        try:
            db.execute(text("DELETE FROM user_center.user_abilities WHERE user_id = :u"), {"u": username})
            for aid in payload.abilityIds:
                db.execute(text(
                    "INSERT INTO user_center.user_abilities (user_id, ability_id, created_at, updated_at)"
                    " VALUES (:u, :a, now(), now())"
                ), {"u": username, "a": aid})
            db.commit()
        finally:
            db.close()
        abilities = _read_user_abilities(username)
        return {"code": 0, "message": "success", "data": {"filled": bool(abilities), "abilities": abilities}}
    except Exception as exc:
        return {"code": 1, "message": f"能力更新失败，请稍后重试: {exc}", "data": None}
