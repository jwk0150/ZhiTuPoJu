# -*- coding: utf-8 -*-
"""用户认证：仅注册过的账号可登录，用户持久化到本地文件。"""
import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

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


@router.post("/login")
def login(req: LoginRequest):
    username = req.username.strip()
    password = req.password

    if not username or not password:
        return error(40001, "用户名和密码不能为空")

    user = USERS.get(username)
    if not user or user["password"] != password:
        return error(40101, "用户名或密码错误")

    return ok({
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

    return ok({"username": username, "role": "user"})


@router.get("/users")
def list_users():
    users = [
        {"username": u["username"], "role": u["role"]}
        for u in USERS.values()
    ]
    return ok(users)
