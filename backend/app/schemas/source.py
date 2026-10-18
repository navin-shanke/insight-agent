"""Shared source and content-snapshot Pydantic contracts.

These schemas define the normalized shape of every external source record
produced by a connector.  They are transport- and persistence-independent;
database models map onto them rather than the other way around.

Timestamp rules (Blueprint Part VI §19):
  - published_at: the source's actual publication date, if reliably known.
  - retrieved_at: the time this system retrieved the source.
  - first_seen_at: first observation by this system (set on creation).
  - last_seen_at: most recent observation (updated on every fetch).

Missing dates remain unknown -- they are never guessed or fabricated.
Every timestamp is timezone-aware (UTC) and serialized as ISO-8601 with
the trailing "Z".
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


def _now_utc() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    from datetime import timezone

    return datetime.now(timezone.utc)


class SourceType(str, Enum):
    """Stable source-type identifiers.  Extend as new platforms are added."""

    WEB_SEARCH = "web_search"
    WEB_PAGE = "web_page"
    RSS = "rss"
    INSTAGRAM_POST = "instagram_post"
    INSTAGRAM_PROFILE = "instagram_profile"
    GITHUB_REPO = "github_repo"
    REDDIT_POST = "reddit_post"
    YOUTUBE_VIDEO = "youtube_video"


class AccessStatus(str, Enum):
    """Explicit connector/source access states (Blueprint Part IV §11)."""

    READY = "READY"
    MISSING_CREDENTIALS = "MISSING_CREDENTIALS"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    RATE_LIMITED = "RATE_LIMITED"
    TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE"
    UNSUPPORTED = "UNSUPPORTED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
    NO_RESULTS = "NO_RESULTS"


class SourceReference(BaseModel):
    """A lightweight, stable reference to a source.

    Used to link discoveries to sources without embedding full records.
    """

    model_config = ConfigDict(frozen=True)

    source_type: str
    canonical_url: HttpUrl
    platform_id: Optional[str] = Field(
        default=None,
        description="Platform-native identifier (e.g. Instagram post id), if available.",
    )
    title: Optional[str] = None
    author_or_publisher: Optional[str] = None


class SourceRecord(BaseModel):
    """Normalized record of a single external source.

    All timestamps are timezone-aware UTC datetimes.  ``published_at`` and
    ``first_seen_at`` may be absent when genuinely unknown; they are never
    substituted for one another.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    source_type: str
    canonical_url: HttpUrl
    platform_id: Optional[str] = None
    title: Optional[str] = None
    author_or_publisher: Optional[str] = None
    published_at: Optional[datetime] = Field(
        default=None,
        description="Source's actual publication time, if reliably known.",
    )
    first_seen_at: datetime = Field(default_factory=_now_utc)
    last_seen_at: datetime = Field(default_factory=_now_utc)
    retrieval_count: int = Field(default=1, ge=0)
    access_status: AccessStatus = AccessStatus.READY
    metadata_json: dict = Field(default_factory=dict)

    @field_validator("published_at", "first_seen_at", "last_seen_at", mode="before")
    @classmethod
    def _require_tz(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if value.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return value


class ContentSnapshot(BaseModel):
    """A single retrieval of a source's content.

    ``content_hash`` is a stable digest of the retrieved body so repeated
    fetches of identical content can be detected and deduplicated.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    source_id: UUID
    retrieved_at: datetime = Field(default_factory=_now_utc)
    content_hash: Optional[str] = Field(
        default=None,
        description="Stable digest of the retrieved body (e.g. SHA-256 hex).",
    )
    caption: Optional[str] = None
    text_content: Optional[str] = None
    transcript: Optional[str] = None
    ocr_text: Optional[str] = None
    access_status: AccessStatus = AccessStatus.READY
    coverage_json: dict = Field(
        default_factory=dict,
        description="Retrieval completeness: comments included, pagination, sampling, limits.",
    )

    @field_validator("retrieved_at", mode="before")
    @classmethod
    def _require_tz_retrieved(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if value.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return value


