"""启动脚本：使用项目虚拟环境并加载 .env 后启动 uvicorn。"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# 从系统 Python 直接运行时，自动切换到项目虚拟环境，避免依赖缺失。
ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
if VENV_PYTHON.is_file() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]])

# 强制从项目根目录加载 .env（override=True 覆盖已存在的空变量）
env_path = ROOT / ".env"
try:
    from dotenv import load_dotenv

    loaded = load_dotenv(env_path, override=True)
    print(f"[run_backend] .env loaded={loaded} from {env_path}")
except Exception as e:
    print(f"[run_backend] load_dotenv error: {e}")

print(f"[run_backend] DEEPSEEK_API_KEY configured: {bool(os.getenv('DEEPSEEK_API_KEY', '').strip())}")

import uvicorn
from backend.config import config

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=config.BACKEND_HOST,
        port=config.BACKEND_PORT,
        reload=False,
    )
