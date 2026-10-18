"""Integration test verifying Alembic migrations apply to a fresh SQLite DB."""

from __future__ import annotations

import os
import subprocess
import tempfile


def test_alembic_upgrade_head_creates_all_tables():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        env = dict(os.environ)
        env["DATABASE_URL"] = f"sqlite:///{path}"
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            env=env,
        )
        assert result.returncode == 0, result.stderr

        import sqlite3

        conn = sqlite3.connect(path)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        conn.close()

        for expected in ("sources", "content_snapshots", "discoveries", "discovery_sources", "alembic_version"):
            assert expected in tables, f"missing table {expected}"
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def test_alembic_check_no_model_drift():
    """Ensure ORM models match the migrated schema (no pending autogenerate diff)."""
    result = subprocess.run(
        ["alembic", "check"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "ORM models and migrated schema are out of sync. "
        "Run `alembic revision --autogenerate` and commit the new migration.\n"
        + result.stdout
        + result.stderr
    )
    assert "No new upgrade operations detected" in result.stdout
