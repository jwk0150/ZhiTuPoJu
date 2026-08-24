# -*- coding: utf-8 -*-
"""PostgreSQL 数据库连接模块 (SQLAlchemy)"""
import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # 从 PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DB 拼装
    _host = os.getenv("PG_HOST", "127.0.0.1")
    _port = os.getenv("PG_PORT", "5433")
    _user = os.getenv("PG_USER", "postgres")
    _pwd = os.getenv("PG_PASSWORD", "20051122")
    _db = os.getenv("PG_DB", "zhitu_crawl_db")
    DATABASE_URL = f"postgresql://{_user}:{quote_plus(_pwd)}@{_host}:{_port}/{_db}"

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入: 获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
