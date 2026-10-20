"""Shared test fixtures for Phase 2 connector-contract tests."""

from __future__ import annotations

import os
import tempfile
from typing import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.models import Base


@pytest.fixture(scope="function")
def db_engine() -> Generator:
    """Create a fresh SQLite database for each test, apply migrations, yield engine."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"timeout": 30}
        )
        Base.metadata.create_all(engine)
        yield engine
    finally:
        engine.dispose()
        try:
            os.remove(path)
        except OSError:
            pass


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator:
    """Yield a SQLAlchemy Session bound to a fresh test database."""
    with Session(db_engine) as session:
        yield session
