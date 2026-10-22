from fastapi.testclient import TestClient

from backend.main import app
from backend.routers import auth


client = TestClient(app)


def _fresh_users(tmp_path, monkeypatch):
    path = tmp_path / "users.json"
    monkeypatch.setattr(auth, "USERS_PATH", path)
    auth.USERS.clear()
    auth.load_users()
    # 测试用空库：不写入默认演示账号
    auth.USERS.clear()
    if path.exists():
        path.unlink()


def test_login_fails_before_register(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    result = client.post("/api/auth/login", json={"username": "alice", "password": "secret1"}).json()
    assert result["code"] != 0
    assert "错误" in result["message"]


def test_legacy_admin_cannot_login_without_seed(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    result = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()
    assert result["code"] != 0


def test_default_accounts_seeded(tmp_path, monkeypatch):
    path = tmp_path / "users.json"
    monkeypatch.setattr(auth, "USERS_PATH", path)
    auth.USERS.clear()
    auth.load_users()
    auth.ensure_default_accounts()
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "shangshanruoshui", "password": "ssrs123"},
    ).json()
    assert admin_login["code"] == 0
    assert admin_login["data"]["role"] == "admin"
    user_login = client.post("/api/auth/login", json={"username": "user", "password": "user123"}).json()
    assert user_login["code"] == 0
    assert user_login["data"]["role"] == "user"


def test_register_rejects_reserved_admin_name(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    result = client.post(
        "/api/auth/register",
        json={"username": "shangshanruoshui", "password": "ssrs123"},
    ).json()
    assert result["code"] != 0


def test_register_then_login_succeeds(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    registered = client.post("/api/auth/register", json={"username": "alice", "password": "secret1"}).json()
    assert registered["code"] == 0
    assert registered["data"]["role"] == "user"
    logged_in = client.post("/api/auth/login", json={"username": "alice", "password": "secret1"}).json()
    assert logged_in["code"] == 0
    assert logged_in["data"]["username"] == "alice"


def test_registered_user_survives_reload(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    client.post("/api/auth/register", json={"username": "bob", "password": "secret1"})
    auth.USERS.clear()
    auth.load_users()
    logged_in = client.post("/api/auth/login", json={"username": "bob", "password": "secret1"}).json()
    assert logged_in["code"] == 0
