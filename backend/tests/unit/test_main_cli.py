"""CLI entry-point dispatch regressions."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

from app import main as main_module


def test_console_entrypoint_dispatches_cancel_subcommand(monkeypatch):
    task_id = str(uuid4())
    called = []
    monkeypatch.setattr(main_module, "cancel_research_task", called.append)
    monkeypatch.setattr(main_module, "serve_api", lambda: (_ for _ in ()).throw(AssertionError("server started")))

    main_module.main(["cancel-research", task_id])

    assert called == [task_id]


def test_cancel_command_uses_uuid_and_configured_database(monkeypatch, capsys):
    task_id = uuid4()
    received = {}

    class FakeResearchService:
        def __init__(self, database_url):
            received["database_url"] = database_url

        def request_cancellation(self, requested_id):
            received["task_id"] = requested_id
            return True

    from app.agents import service as service_module

    monkeypatch.setattr(service_module, "ResearchService", FakeResearchService)
    monkeypatch.setattr(main_module, "get_settings", lambda: SimpleNamespace(
        database_url="sqlite+aiosqlite:///./disposable.db"
    ))

    main_module.cancel_research_task(str(task_id))

    assert received == {
        "database_url": "sqlite:///./disposable.db",
        "task_id": UUID(str(task_id)),
    }
    assert "Cancellation request recorded." in capsys.readouterr().out


def test_no_argument_console_entrypoint_still_starts_server(monkeypatch):
    calls = []
    monkeypatch.setattr(main_module, "serve_api", lambda: calls.append("serve"))

    main_module.main([])

    assert calls == ["serve"]
