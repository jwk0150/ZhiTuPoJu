"""Administrator-only read models and operational overview."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends

from backend.routers.auth import require_admin

router = APIRouter()


def _envelope(data_value: Any, *, data_source: str = "live", as_of: str | None = None, message: str = "success") -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "code": 0,
        "message": message,
        "data": data_value,
        "data_source": data_source,
        "generated_at": now,
        "as_of": as_of or now,
        "request_id": None,
    }


def _unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and payload.get("code") not in (None, 0):
        return None
    return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload


@router.get("/session")
def admin_session(current_user: dict = Depends(require_admin)):
    return _envelope({
        "username": current_user["username"],
        "role": current_user["role"],
        "permissions": ["admin:read"],
    })


@router.get("/overview")
def admin_overview(current_user: dict = Depends(require_admin)):
    """Return resource-level health without collapsing outages into empty data."""
    resources: dict[str, dict] = {
        "health": {"status": "live", "data": {"status": "ok"}},
    }
    try:
        stats = _load_stats()
        resources["stats"] = {
            "status": "live" if stats is not None else "unavailable",
            "data": stats,
            "reason": None if stats is not None else "database unavailable",
        }
    except Exception as exc:
        resources["stats"] = {"status": "error", "data": None, "reason": str(exc)}
    return _envelope({"resources": resources}, data_source="live")


def _load_stats():
    from backend.data import get_db_stats
    return get_db_stats()


@router.get("/users")
def admin_users(current_user: dict = Depends(require_admin)):
    from backend.routers.auth import USERS
    users = [{"username": u["username"], "role": u["role"]} for u in USERS.values()]
    return _envelope(users)


@router.get("/audit")
def admin_audit(current_user: dict = Depends(require_admin)):
    return _envelope([], data_source="unavailable", message="审计接口尚未接入")
