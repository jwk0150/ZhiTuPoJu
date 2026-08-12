#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配置验证脚本 — 检查开发环境配置是否正确"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import config


def check_deepseek():
    """检查 DeepSeek API 配置"""
    if not config.DEEPSEEK_API_KEY:
        print("❌ DEEPSEEK_API_KEY 未配置")
        print("   请在 .env 文件中设置 DEEPSEEK_API_KEY")
        return False
    print(f"✅ DeepSeek API 已配置 ({config.DEEPSEEK_MODEL})")
    return True


def check_database():
    """检查数据库连接配置"""
    print(f"📊 数据库配置:")
    print(f"   Host: {config.PG_HOST}:{config.PG_PORT}")
    print(f"   Database: {config.PG_DB}")
    print(f"   User: {config.PG_USER}")
    print(f"   Table Prefix: {config.TABLE_PREFIX}")

    # 尝试连接数据库
    try:
        from backend.db import get_session
        with get_session() as session:
            result = session.execute("SELECT version();")
            version = result.scalar()
            print(f"✅ 数据库连接成功")
            print(f"   PostgreSQL Version: {version.split(',')[0]}")
            return True
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print(f"   请检查 PostgreSQL 是否在 {config.PG_HOST}:{config.PG_PORT} 运行")
        return False


def check_tables():
    """检查必需的表是否存在"""
    required_tables = [
        f"{config.TABLE_PREFIX}job_postings",
        f"{config.TABLE_PREFIX}job_posting_details",
    ]

    try:
        from backend.db import get_session
        with get_session() as session:
            for table in required_tables:
                result = session.execute(
                    f"SELECT COUNT(*) FROM {table};"
                )
                count = result.scalar()
                print(f"✅ 表 {table} 存在 ({count} 条记录)")
            return True
    except Exception as e:
        print(f"❌ 表检查失败: {e}")
        return False


def check_backend_config():
    """检查后端服务配置"""
    print(f"🚀 后端服务配置:")
    print(f"   Host: {config.BACKEND_HOST}")
    print(f"   Port: {config.BACKEND_PORT}")
    print(f"   访问地址: http://{config.BACKEND_HOST}:{config.BACKEND_PORT}")
    return True


def main():
    print("=" * 60)
    print("🔍 配置检查")
    print("=" * 60)
    print()

    all_passed = True

    # DeepSeek API
    if not check_deepseek():
        all_passed = False
    print()

    # 数据库连接
    if not check_database():
        all_passed = False
    print()

    # 表检查
    if not check_tables():
        all_passed = False
    print()

    # 后端配置
    check_backend_config()
    print()

    print("=" * 60)
    if all_passed:
        print("✅ 所有配置检查通过！")
        print("=" * 60)
        return 0
    else:
        print("❌ 部分配置检查失败，请修复后重试")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
