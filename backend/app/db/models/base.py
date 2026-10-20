"""SQLAlchemy declarative base and shared metadata for Insight Agent models."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

# Naming conventions make Alembic autogenerate deterministic constraint names.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Base(DeclarativeBase):
    """Base class for all ORM models.

    Uses SQLAlchemy 2.x mapped-as-dataclass style so ORM instances are
    straightforward to construct and inspect.  Metadata carries the naming
    conventions above for stable constraint/index names.
    """

    metadata = metadata

    __allow_unmapped__ = True

