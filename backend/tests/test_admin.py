from fastapi.testclient import TestClient

from backend.main import app
from backend.routers import auth


client = TestClient(app)


def _users(monkeypatch):
    monkeypatch.setattr(auth, "USERS", {
        "reader": {"username": "reader", "password": "secret1", "role": "user"},
        "operator": {"username": "operator", "password": "secret1", "role": "ADMIN"},
    })


def _token(username, role):
    return auth.create_token(username, role)


def test_admin_session_requires_admin(monkeypatch):
    _users(monkeypatch)
    assert client.get("/api/admin/session").status_code == 401
    user_headers = {"Authorization": "Bearer " + _token("reader", "user")}
    assert client.get("/api/admin/session", headers=user_headers).status_code == 403


def test_admin_session_returns_normalized_contract(monkeypatch):
    _users(monkeypatch)
    headers = {"Authorization": "Bearer " + _token("operator", "ADMIN")}
    response = client.get("/api/admin/session", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 0
    assert payload["data"]["username"] == "operator"
    assert payload["data"]["permissions"] == ["admin:read"]
    assert payload["data_source"] == "live"
    assert payload["generated_at"]
    assert payload["as_of"]


def test_admin_users_never_exposes_password(monkeypatch):
    _users(monkeypatch)
    headers = {"Authorization": "Bearer " + _token("operator", "ADMIN")}
    response = client.get("/api/admin/users", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"] == [
        {"username": "reader", "role": "user"},
        {"username": "operator", "role": "ADMIN"},
    ]
    assert "password" not in response.text


def test_auth_users_is_admin_only(monkeypatch):
    _users(monkeypatch)
    headers = {"Authorization": "Bearer " + _token("reader", "user")}
    assert client.get("/api/auth/users", headers=headers).status_code == 403
