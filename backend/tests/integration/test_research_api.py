"""Integration tests for Phase 5 REST API endpoints."""

from __future__ import annotations

import tempfile
import os
import uuid
import pytest
from fastapi.testclient import TestClient

from app.api.v1.auth import _create_access_token
from app.core.config import get_settings
from app.db.models import Base, TaskCheckpoint, Discovery, Report, Watchlist, ScheduledRun
from app.main import create_app
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def disposable_app(monkeypatch):
    """Create a FastAPI TestClient pointed at a clean temporary database."""
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)

    engine = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(engine)

    settings = get_settings()
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    monkeypatch.setattr(settings, "auth_secret_key", "integration-test-secret-key-phase5-very-long")
    monkeypatch.setattr(settings, "admin_username", "admin")

    app = create_app()
    client = TestClient(app)
    token = _create_access_token({"sub": "admin"}, expires_delta=None)
    auth_headers = {"Authorization": f"Bearer {token}"}

    yield client, auth_headers, path, engine

    engine.dispose()
    try:
        os.remove(path)
    except OSError:
        pass


def test_overview_metrics_endpoint(disposable_app):
    client, headers, _, engine = disposable_app

    # Verify unauthenticated call is rejected
    unauth = client.get("/api/v1/metrics/overview")
    assert unauth.status_code == 401

    # Insert sample records
    with Session(engine) as s:
        s.add(
            Discovery(
                id=uuid.uuid4(),
                title="AI Research Advancement",
                summary="Researchers discovered a new agentic architecture.",
                category="AI",
                verification_status="VERIFIED",
            )
        )
        s.add(
            Report(
                id=uuid.uuid4().hex,
                title="Weekly Synthesis",
                query="Emerging LLMs",
                body_md="# Summary\nAll good.",
            )
        )
        s.commit()

    # Authenticated call
    res = client.get("/api/v1/metrics/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_discoveries"] == 1
    assert data["total_reports"] == 1


def test_research_submission_and_lifecycle(disposable_app, monkeypatch):
    client, headers, _, engine = disposable_app

    # Mock the background worker so it doesn't execute real network DDG queries
    async def dummy_worker(*args, **kwargs):
        pass
    monkeypatch.setattr("app.api.v1.research.submit_research_task", dummy_worker)

    # Submit bounded research
    payload = {
        "query": "Test integration research task for Phase 5",
        "source_budget": 5,
        "max_iterations": 1,
        "time_budget_seconds": 60,
        "token_budget": 5000,
    }
    submit_res = client.post("/api/v1/research", json=payload, headers=headers)
    assert submit_res.status_code == 202
    task_data = submit_res.json()
    task_id = task_data["task_id"]
    assert task_data["status"] == "running"

    # Get status via polling endpoint
    status_res = client.get(f"/api/v1/research/{task_id}", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["task_id"] == task_id

    # Request cooperative cancellation
    cancel_res = client.delete(f"/api/v1/research/{task_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["accepted"] is True


def test_watchlists_crud_api(disposable_app):
    client, headers, _, _ = disposable_app

    # List empty
    list_res = client.get("/api/v1/watchlists", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0

    # Create watchlist
    create_res = client.post(
        "/api/v1/watchlists",
        json={
            "name": "Biotech Agents",
            "topic": "Autonomous lab research",
            "keywords": ["crispr", "synthesis"],
            "enabled": True,
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    wl = create_res.json()
    wl_id = wl["id"]
    assert wl["name"] == "Biotech Agents"

    # Update (toggle disabled)
    update_res = client.patch(
        f"/api/v1/watchlists/{wl_id}",
        json={"enabled": False},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["enabled"] is False

    # Delete
    del_res = client.delete(f"/api/v1/watchlists/{wl_id}", headers=headers)
    assert del_res.status_code == 204


def test_health_ready_probe(disposable_app):
    client, _, _, _ = disposable_app
    res = client.get("/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "ollama" in data
    assert "duckduckgo" in data
