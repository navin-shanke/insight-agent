"""Database models package.

Imports all ORM models so that ``Base.metadata`` (used by Alembic
autogenerate) is fully populated when this package is imported.
"""

from .base import Base, metadata
from .source import Source
from .content_snapshot import ContentSnapshot
from .discovery import Discovery, DiscoverySource
from .claim import Claim
from .evidence import Evidence
from .report import Report
from .checkpoint import TaskCheckpoint
from .watchlist import Watchlist
from .scheduled_run import ScheduledRun

__all__ = [
    "Base",
    "metadata",
    "Source",
    "ContentSnapshot",
    "Discovery",
    "DiscoverySource",
    "Claim",
    "Evidence",
    "Report",
    "TaskCheckpoint",
    "Watchlist",
    "ScheduledRun",
]

