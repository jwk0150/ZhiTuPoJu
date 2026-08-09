# -*- coding: utf-8 -*-
"""用户认证路由 - 模拟实现（无真实数据库）"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# 模拟用户数据库（内存存储）
MOCK_USERS = {
    "admin": {"username": "admin", "password": "admin123", "role": "admin"},
    "user": {"username": "user", "password": "user123", "role": "user"},
}


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


def ok(data):
    return {"code": 0, "message": "success", "data": data}


def error(code: int, message: str):
    return {"code": code, "message": message, "data": None}


@router.post("/login")
def login(req: LoginRequest):
    """用户登录"""
    username = req.username.strip()
    password = req.password

    if not username or not password:
        return error(40001, "用户名和密码不能为空")

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
    })


@router.post("/register")
def register(req: RegisterRequest):
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
        "username": username,
        "password": password,
        "role": "user",
    }

    return ok({"username": username, "role": "user"})


@router.get("/users")
def list_users():
    """获取所有用户列表（开发测试用）"""
    users = [
        {"username": u["username"], "role": u["role"]}
        for u in MOCK_USERS.values()
    ]
    return ok(users)
