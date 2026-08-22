# -*- coding: utf-8 -*-
<<<<<<< HEAD
"""用户认证路由 - 模拟实现（无真实数据库）"""
from fastapi import APIRouter, HTTPException
=======
"""用户认证：仅注册过的账号可登录，用户持久化到本地文件。"""
import json
from pathlib import Path

from fastapi import APIRouter
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
from pydantic import BaseModel

router = APIRouter()

<<<<<<< HEAD
# 模拟用户数据库（内存存储）
MOCK_USERS = {
    "admin": {"username": "admin", "password": "admin123", "role": "admin"},
    "user": {"username": "user", "password": "user123", "role": "user"},
}
=======
USERS_PATH = Path(__file__).resolve().parent.parent / "data" / "users.json"
USERS: dict[str, dict] = {}
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


<<<<<<< HEAD
=======
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


>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
def ok(data):
    return {"code": 0, "message": "success", "data": data}


def error(code: int, message: str):
    return {"code": code, "message": message, "data": None}


@router.post("/login")
def login(req: LoginRequest):
<<<<<<< HEAD
    """用户登录"""
=======
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
    username = req.username.strip()
    password = req.password

    if not username or not password:
        return error(40001, "用户名和密码不能为空")

<<<<<<< HEAD
    # 检查用户是否存在
    user = MOCK_USERS.get(username)
    if not user:
        return error(40101, "用户名或密码错误")

    # 验证密码
    if user["password"] != password:
        return error(40101, "用户名或密码错误")

    # 返回用户信息（不含密码）
    return ok({
        "username": user["username"],
        "role": user["role"],
        "loginTime": None,  # 前端会自己设置
=======
    user = USERS.get(username)
    if not user or user["password"] != password:
        return error(40101, "用户名或密码错误")

    return ok({
        "username": user["username"],
        "role": user["role"],
        "loginTime": None,
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
    })


@router.post("/register")
def register(req: RegisterRequest):
<<<<<<< HEAD
    """用户注册"""
    username = req.username.strip()
    password = req.password

    # 校验用户名
    if not username or len(username) < 3 or len(username) > 20:
        return error(40001, "用户名长度应为3-20个字符")

    # 校验密码
    if not password or len(password) < 6:
        return error(40001, "密码长度至少6位")

    # 检查用户名是否已存在
    if username in MOCK_USERS:
        return error(40901, "用户名已存在")

    # 添加新用户
    MOCK_USERS[username] = {
=======
    username = req.username.strip()
    password = req.password

    if not username or len(username) < 3 or len(username) > 20:
        return error(40001, "用户名长度应为3-20个字符")

    if not password or len(password) < 6:
        return error(40001, "密码长度至少6位")

    if username in USERS:
        return error(40901, "用户名已存在")

    USERS[username] = {
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
        "username": username,
        "password": password,
        "role": "user",
    }
<<<<<<< HEAD
=======
    save_users()
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338

    return ok({"username": username, "role": "user"})


@router.get("/users")
def list_users():
<<<<<<< HEAD
    """获取所有用户列表（开发测试用）"""
    users = [
        {"username": u["username"], "role": u["role"]}
        for u in MOCK_USERS.values()
=======
    users = [
        {"username": u["username"], "role": u["role"]}
        for u in USERS.values()
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338
    ]
    return ok(users)
