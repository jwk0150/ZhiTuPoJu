# -*- coding: utf-8 -*-
"""统一配置管理 — 解决不同开发者环境差异"""
import os
from pathlib import Path
<<<<<<< HEAD
=======
from urllib.parse import quote_plus
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338

from dotenv import load_dotenv

# 加载 .env 文件（override=True 确保覆盖系统环境变量）
_ENV_PATH = Path(__file__).parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=True)


class Config:
    """应用配置类 — 所有配置项从环境变量读取，并提供合理的默认值"""

    # ============ DeepSeek AI ============
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # ============ PostgreSQL ============
    PG_HOST: str = os.getenv("PG_HOST", "127.0.0.1")
    PG_PORT: int = int(os.getenv("PG_PORT", "5432"))  # 标准PostgreSQL端口
    PG_USER: str = os.getenv("PG_USER", "postgres")
    PG_PASSWORD: str = os.getenv("PG_PASSWORD", "")
    PG_DB: str = os.getenv("PG_DB", "zhilian_crawl_db")

    # ============ 后端服务 ============
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
<<<<<<< HEAD
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
=======
    # 前端静态页面默认连接 5000，后端默认值必须与其一致。
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "5000"))
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338

    # ============ 表名前缀配置 ============
    # 不同环境可能使用不同的表名前缀（如：zhilian_、boss_、lagou_）
    TABLE_PREFIX: str = os.getenv("TABLE_PREFIX", "zhilian_")

    @classmethod
    def get_db_url(cls) -> str:
        """生成数据库连接URL"""
        return (
<<<<<<< HEAD
            f"postgresql://{cls.PG_USER}:{cls.PG_PASSWORD}@"
=======
            f"postgresql://{cls.PG_USER}:{quote_plus(cls.PG_PASSWORD)}@"
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
            f"{cls.PG_HOST}:{cls.PG_PORT}/{cls.PG_DB}"
        )

    @classmethod
    def get_table_name(cls, base_name: str) -> str:
        """根据配置的前缀生成完整表名"""
        return f"{cls.TABLE_PREFIX}{base_name}"


# 全局配置实例
config = Config()
