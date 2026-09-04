# -*- coding: utf-8 -*-
"""用户认证：仅注册过的账号可登录，用户持久化到本地文件。

Phase 1（Global Agent）：新增 JWT Bearer Token 认证（纯标准库 HS256，无新依赖）。
- login 返回结构保持向后兼容（原 username/role/loginTime 字段不变，新增 token/user）。
- get_current_user 作为 FastAPI 依赖，供 Global Agent API 统一取当前用户。
"""
import base64
import hashlib
import hmac
import json
import time
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from backend.config import config

router = APIRouter()

USERS_PATH = Path(__file__).resolve().parent.parent / "data" / "users.json"
USERS: dict[str, dict] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


def load_users() -> None:
    USERS.clear()
    if not USERS_PATH.exists():
        return
    try:
        payload = json.loads(USERS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if isinstance(payload, dict):
        for username, user in payload.items():
            if isinstance(user, dict) and user.get("username") and user.get("password"):
                USERS[str(username)] = {
                    "username": str(user["username"]),
                    "password": str(user["password"]),
                    "role": str(user.get("role") or "user"),
                }


def save_users() -> None:
    USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    USERS_PATH.write_text(
        json.dumps(USERS, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


load_users()


def ok(data):
    return {"code": 0, "message": "success", "data": data}


def error(code: int, message: str):
    return {"code": code, "message": message, "data": None}


# ============================================================
# JWT（HS256，纯标准库）
# ============================================================
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def create_token(username: str, role: str) -> str:
    """签发 JWT（HS256）。payload: sub=username, role, iat, exp。"""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": username, "role": role, "iat": now, "exp": now + config.JWT_TTL}
    encoded_header = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(config.JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64url(signature)}"


def verify_token(token: str) -> dict | None:
    """校验 JWT，返回 payload；无效/过期返回 None。"""
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except (ValueError, AttributeError):
        return None
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected = hmac.new(config.JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        actual = _b64url_decode(signature_b64)
    except Exception:
        return None
    if not hmac.compare_digest(actual, expected):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        return None
    if not isinstance(payload, dict) or int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI 依赖：解析 Authorization: Bearer <token>，返回 {username, role}。

    Global Agent 相关 API 必须依赖它取当前用户；前端传入的任何 user_id 一律不作为权限依据。
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="未登录或缺少认证信息")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期或凭证无效")
    username = str(payload.get("sub") or "")
    user = USERS.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return {"username": user["username"], "role": user["role"]}


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """FastAPI 依赖：仅允许服务端用户记录中的管理员访问。"""
    role = str(current_user.get("role") or "").strip().lower()
    if role not in {"admin", "administrator"}:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user


@router.post("/login")
def login(req: LoginRequest):
    username = req.username.strip()
    password = req.password

    if not username or not password:
        return error(40001, "用户名和密码不能为空")

    user = USERS.get(username)
    if not user or user["password"] != password:
        return error(40101, "用户名或密码错误")

    # 兼容历史 JSON 账号：首次登录时补建用户中心主档。
    try:
        from backend.db import SessionLocal
        from backend.models.user_profile import UserProfile
        db = SessionLocal()
        try:
            if not db.query(UserProfile).filter(UserProfile.user_id == username).first():
                db.add(UserProfile(user_id=username, name=username, completion=20))
                db.commit()
        finally:
            db.close()
    except Exception:
        pass

    token = create_token(user["username"], user["role"])
    return ok({
        "token": token,
        "user": {"username": user["username"], "role": user["role"]},
        # —— 兼容旧字段（原前端 localStorage.zhitu_user = 整个 data 对象）——
        "username": user["username"],
        "role": user["role"],
        "loginTime": None,
    })


@router.post("/register")
def register(req: RegisterRequest):
    username = req.username.strip()
    password = req.password

    if not username or len(username) < 3 or len(username) > 20:
        return error(40001, "用户名长度应为3-20个字符")

    if not password or len(password) < 6:
        return error(40001, "密码长度至少6位")

    if username in USERS:
        return error(40901, "用户名已存在")

    USERS[username] = {
        "username": username,
        "password": password,
        "role": "user",
    }
    save_users()

    # 注册即初始化用户中心资料，后续简历/收藏均可关联到该账号。
    try:
        from backend.db import SessionLocal
        from backend.models.user_profile import UserProfile
        db = SessionLocal()
        try:
            if not db.query(UserProfile).filter(UserProfile.user_id == username).first():
                db.add(UserProfile(user_id=username, name=username, completion=20))
                db.commit()
        finally:
            db.close()
    except Exception:
        # 数据库暂不可用时不影响已有 JSON 认证流程，首次访问用户中心时再创建资料。
        pass

    return ok({"username": username, "role": "user"})


@router.get("/users", dependencies=[Depends(require_admin)])
def list_users():
    users = [
        {"username": u["username"], "role": u["role"]}
        for u in USERS.values()
    ]
    return ok(users)
