"""启动脚本：确保 .env 被正确加载后再启动 uvicorn。"""
import os
from pathlib import Path

# 强制从项目根目录加载 .env（override=True 覆盖已存在的空变量）
ROOT = Path(__file__).resolve().parent
env_path = ROOT / ".env"
try:
    from dotenv import load_dotenv

    loaded = load_dotenv(env_path, override=True)
    print(f"[run_backend] .env loaded={loaded} from {env_path}")
except Exception as e:
    print(f"[run_backend] load_dotenv error: {e}")

print(f"[run_backend] DEEPSEEK_API_KEY configured: {bool(os.getenv('DEEPSEEK_API_KEY', '').strip())}")

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=5000,
        reload=False,
    )
