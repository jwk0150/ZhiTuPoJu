from fastapi.testclient import TestClient

from backend.main import app
from backend.routers import auth


client = TestClient(app)


def _fresh_users(tmp_path, monkeypatch):
    path = tmp_path / "users.json"
    monkeypatch.setattr(auth, "USERS_PATH", path)
    auth.USERS.clear()
    auth.load_users()


def test_login_fails_before_register(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    result = client.post("/api/auth/login", json={"username": "alice", "password": "secret1"}).json()
    assert result["code"] != 0
    assert "错误" in result["message"]


def test_seeded_admin_cannot_login_without_register(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    result = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()
    assert result["code"] != 0


def test_register_then_login_succeeds(tmp_path, monkeypatch):
    _fresh_users(tmp_path, monkeypatch)
    registered = client.post("/api/auth/register", json={"username": "alice", "password": "secret1"}).json()
    assert registered["code"] == 0
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
