"""Unit tests for Phase 5 authentication module."""

from __future__ import annotations

import pytest
import bcrypt
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.auth import _create_access_token, get_current_user
from app.core.config import get_settings
from app.main import create_app


def test_auth_token_unconfigured(monkeypatch):
    """When ADMIN_USERNAME or ADMIN_PASSWORD_HASH is unset, /auth/token returns 503."""
    settings = get_settings()
    monkeypatch.setattr(settings, "admin_username", "")
    monkeypatch.setattr(settings, "admin_password_hash", "")

    app = create_app()
    client = TestClient(app)

    res = client.post("/api/v1/auth/token", data={"username": "admin", "password": "secret"})
    assert res.status_code == 503
    assert "Authentication is not configured" in res.json()["detail"]


def test_auth_token_valid_and_invalid(monkeypatch):
    """Valid credentials return a bearer token; invalid return 401."""
    settings = get_settings()
    pw_hash = bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()).decode("utf-8")
    monkeypatch.setattr(settings, "admin_username", "researcher")
    monkeypatch.setattr(settings, "admin_password_hash", pw_hash)
    monkeypatch.setattr(settings, "auth_secret_key", "test-secret-key-very-long-and-secure-123456")

    app = create_app()
    client = TestClient(app)

    # Invalid password
    res_bad = client.post("/api/v1/auth/token", data={"username": "researcher", "password": "wrong"})
    assert res_bad.status_code == 401

    # Valid password
    res_ok = client.post(
        "/api/v1/auth/token",
        data={"username": "researcher", "password": "correct-horse-battery-staple"},
    )
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_current_user_validation(monkeypatch):
    """get_current_user validates bearer token and rejects invalid tokens."""
    settings = get_settings()
    monkeypatch.setattr(settings, "auth_secret_key", "test-secret-key-very-long-and-secure-123456")

    valid_token = _create_access_token({"sub": "admin_user"})
    user = await get_current_user(token=valid_token)
    assert user.sub == "admin_user"

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token="invalid.token.payload")
    assert exc_info.value.status_code == 401
