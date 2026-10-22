"""Instagram Batch Import Service — CSV and JSON Parsing, Validation & Ingestion.

Supports:
1. CSV files with flexible, case-insensitive headers (comma or semicolon delimited).
2. JSON files (arrays of objects or enveloped objects `{"posts": [...]}`).
3. Strict metric preservation: missing metrics remain `None` / `null`, never 0.
4. Duplicate detection across existing database records and intra-file duplicates.
5. Two-phase import: Preview -> User Confirmation -> Safe Atomic Commit.
"""

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from app.schemas.api.instagram import (
    BatchImportCommitRequest,
    BatchImportCommitResponse,
    BatchImportItemPreview,
    BatchImportPreviewResponse,
    InstagramMetrics,
    InstagramObservationIn,
)
from app.services.instagram_learning import InstagramLearningService, _extract_hook, _extract_hashtags


def _normalize_url(url: Optional[str]) -> str:
    if not url:
        return ""
    clean = url.strip().rstrip("/")
    # Normalize http to https if present
    if clean.startswith("http://"):
        clean = "https://" + clean[7:]
    return clean.lower()


def _normalize_format(fmt: Optional[str]) -> str:
    if not fmt:
        return "unknown"
    f = fmt.strip().lower()
    if any(k in f for k in ["reel", "video", "short", "clip"]):
        return "reel"
    if any(k in f for k in ["carousel", "album", "slide", "multi"]):
        return "carousel"
    if any(k in f for k in ["image", "photo", "picture", "static"]):
        return "image"
    return "unknown"


def _parse_int_metric(val: Any) -> Optional[int]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "n/a", "na", "-", "", "undefined"):
        return None
    # Strip commas or periods in thousands (e.g. 1,500 or 1.500 if integer)
    s_clean = s.replace(",", "").replace(" ", "")
    try:
        num = int(float(s_clean))
        return num if num >= 0 else None
    except (ValueError, TypeError):
        return None


def _parse_timestamp(val: Any) -> Optional[datetime]:
    if not val:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "n/a", "-"):
        return None
    # Try ISO format
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    # Common format fallbacks
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


class InstagramBatchService:
    """Handles previewing and committing batch observation imports."""

    @staticmethod
    def _map_row_fields(row: Dict[str, Any]) -> Dict[str, Any]:
        """Case-insensitive, alias-tolerant field extraction from row dict."""
        normalized: Dict[str, Any] = {}
        for k, v in row.items():
            if not k:
                continue
            key = k.strip().lower().replace(" ", "_").replace("-", "_")
            normalized[key] = v

        def _get(*aliases: str) -> Optional[Any]:
            for a in aliases:
                if a in normalized and normalized[a] not in (None, ""):
                    return normalized[a]
            return None

        # Source URL
        source_url = _get("source_url", "url", "permalink", "link", "post_url", "web_url")
        # Caption
        caption = _get("caption", "text", "description", "post_text", "content", "body")
        # Format
        fmt = _get("format", "post_type", "type", "media_type")
        # Account
        handle = _get("account_handle", "account", "handle", "creator", "username", "profile", "author")
        # Content ID
        content_id = _get("content_id", "id", "shortcode", "post_id", "code")
        # Hook
        hook = _get("hook", "opening_hook", "first_line")
        # Posted at
        posted_at = _get("posted_at", "timestamp", "date", "publish_date", "created_at", "post_time")

        # Metrics
        likes = _parse_int_metric(_get("likes", "like_count", "likes_count", "favorite_count"))
        views = _parse_int_metric(_get("views", "view_count", "views_count", "video_views", "play_count", "plays"))
        comments = _parse_int_metric(_get("comments", "comment_count", "comments_count"))
        shares = _parse_int_metric(_get("shares", "share_count", "shares_count"))
        saves = _parse_int_metric(_get("saves", "save_count", "saves_count", "bookmarks", "bookmark_count"))

        notes = _get("notes", "note", "provenance_notes", "context")

        return {
            "source_url": str(source_url).strip() if source_url else None,
            "caption": str(caption).strip() if caption else None,
            "format": _normalize_format(str(fmt)) if fmt else "unknown",
            "account_handle": str(handle).strip() if handle else None,
            "content_id": str(content_id).strip() if content_id else None,
            "hook": str(hook).strip() if hook else None,
            "posted_at": _parse_timestamp(posted_at),
            "metrics": InstagramMetrics(
                likes=likes,
                views=views,
                comments=comments,
                shares=shares,
                saves=saves,
            ),
            "notes": str(notes).strip() if notes else None,
        }

    @classmethod
    def parse_raw_content(
        cls,
        content_bytes: bytes,
        filename: str,
        service: InstagramLearningService,
    ) -> BatchImportPreviewResponse:
        """Parse raw file bytes (CSV or JSON), validate, and check for duplicates."""
        is_json = filename.lower().endswith(".json") or content_bytes.lstrip().startswith(b"[" or b"{")
        raw_rows: List[Dict[str, Any]] = []

        if is_json:
            try:
                decoded = content_bytes.decode("utf-8-sig")
                parsed_json = json.loads(decoded)
                if isinstance(parsed_json, list):
                    raw_rows = [r for r in parsed_json if isinstance(r, dict)]
                elif isinstance(parsed_json, dict):
                    # Check envelope keys: posts, data, items, observations
                    for key in ("posts", "data", "items", "observations", "records"):
                        if key in parsed_json and isinstance(parsed_json[key], list):
                            raw_rows = [r for r in parsed_json[key] if isinstance(r, dict)]
                            break
                    if not raw_rows:
                        raw_rows = [parsed_json]
            except Exception as exc:
                return BatchImportPreviewResponse(
                    total_rows=0,
                    valid_count=0,
                    duplicate_count=0,
                    invalid_count=1,
                    items=[
                        BatchImportItemPreview(
                            row_index=0,
                            status="invalid",
                            reasons=[f"Invalid JSON file format: {str(exc)}"],
                        )
                    ],
                    can_commit=False,
                    import_token="",
                )
        else:
            # Parse CSV
            try:
                decoded = content_bytes.decode("utf-8-sig")
            except UnicodeDecodeError:
                decoded = content_bytes.decode("latin-1")

            # Detect delimiter (comma, semicolon, tab)
            sample = decoded[:4096]
            dialect = csv.excel
            if ";" in sample and sample.count(";") > sample.count(","):
                dialect = csv.excel
                delimiter = ";"
            elif "\t" in sample and sample.count("\t") > sample.count(","):
                delimiter = "\t"
            else:
                delimiter = ","

            reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            for r in reader:
                raw_rows.append(r)

        # Existing database observations for duplicate lookup
        existing = service.list_observations(limit=5000)
        existing_urls: Set[str] = {_normalize_url(o.source_url) for o in existing if o.source_url}
        existing_ids: Set[str] = {o.content_id.strip() for o in existing if o.content_id}

        seen_in_batch_urls: Set[str] = set()
        seen_in_batch_ids: Set[str] = set()

        preview_items: List[BatchImportItemPreview] = []
        valid_count = 0
        duplicate_count = 0
        invalid_count = 0

        for idx, row in enumerate(raw_rows, start=1):
            mapped = cls._map_row_fields(row)
            source_url = mapped.get("source_url")
            caption = mapped.get("caption")
            content_id = mapped.get("content_id")
            fmt = mapped.get("format", "unknown")
            handle = mapped.get("account_handle")
            metrics = mapped.get("metrics")
            posted_at = mapped.get("posted_at")
            notes = mapped.get("notes")

            reasons: List[str] = []
            status = "valid"

            # 1. Validation checks
            if not source_url:
                reasons.append("Missing required source URL")
                status = "invalid"
            elif not (source_url.startswith("http://") or source_url.startswith("https://")):
                reasons.append(f"Invalid URL protocol: '{source_url}'")
                status = "invalid"

            if not caption:
                reasons.append("Missing required caption text")
                status = "invalid"

            # 2. Duplicate checks (if URL is valid)
            norm_url = _normalize_url(source_url) if source_url else ""
            if status != "invalid" and norm_url:
                if norm_url in existing_urls:
                    reasons.append(f"Duplicate post: URL already exists in database ({source_url})")
                    status = "duplicate"
                elif content_id and content_id in existing_ids:
                    reasons.append(f"Duplicate post: content_id '{content_id}' already exists in database")
                    status = "duplicate"
                elif norm_url in seen_in_batch_urls:
                    reasons.append(f"Duplicate post: duplicate URL within uploaded file ({source_url})")
                    status = "duplicate"
                elif content_id and content_id in seen_in_batch_ids:
                    reasons.append(f"Duplicate post: duplicate content_id within uploaded file ({content_id})")
                    status = "duplicate"

            # Record seen for intra-batch duplicate tracking
            if norm_url:
                seen_in_batch_urls.add(norm_url)
            if content_id:
                seen_in_batch_ids.add(content_id)

            parsed_obs: Optional[InstagramObservationIn] = None
            if status == "valid":
                valid_count += 1
                hook_extracted = mapped.get("hook") or _extract_hook(caption or "")
                hashtags_extracted = _extract_hashtags(caption or "")
                parsed_obs = InstagramObservationIn(
                    source_url=source_url,  # type: ignore[arg-type]
                    account_handle=handle,
                    content_id=content_id,
                    format=fmt,  # type: ignore[arg-type]
                    caption=caption,  # type: ignore[arg-type]
                    hook=hook_extracted,
                    hashtags=hashtags_extracted,
                    posted_at=posted_at,
                    collection_method="dataset_export",
                    provenance_notes=f"Batch import from '{filename}' (row {idx})",
                    metrics=metrics,
                    notes=notes,
                )
            elif status == "duplicate":
                duplicate_count += 1
            else:
                invalid_count += 1

            caption_preview = (caption[:80] + "...") if caption and len(caption) > 80 else caption

            preview_items.append(
                BatchImportItemPreview(
                    row_index=idx,
                    status=status,  # type: ignore[arg-type]
                    source_url=source_url,
                    account_handle=handle,
                    content_id=content_id,
                    format=fmt,
                    caption_preview=caption_preview,
                    metrics=metrics,
                    posted_at=posted_at,
                    reasons=reasons,
                    parsed_observation=parsed_obs,
                )
            )

        token = str(uuid4())
        return BatchImportPreviewResponse(
            total_rows=len(preview_items),
            valid_count=valid_count,
            duplicate_count=duplicate_count,
            invalid_count=invalid_count,
            items=preview_items,
            can_commit=(valid_count > 0),
            import_token=token,
        )

    @classmethod
    def commit_batch_import(
        cls,
        req: BatchImportCommitRequest,
        service: InstagramLearningService,
    ) -> BatchImportCommitResponse:
        """Atomically persist validated observations, skipping duplicates."""
        existing = service.list_observations(limit=5000)
        existing_urls = {_normalize_url(o.source_url) for o in existing if o.source_url}
        existing_ids = {o.content_id.strip() for o in existing if o.content_id}

        imported_ids: List[str] = []
        skipped_count = 0

        # Ingest each non-duplicate valid item
        for item in req.items:
            norm_url = _normalize_url(item.source_url)
            if req.skip_duplicates:
                if norm_url in existing_urls:
                    skipped_count += 1
                    continue
                if item.content_id and item.content_id.strip() in existing_ids:
                    skipped_count += 1
                    continue

            # Ensure provenance label is noted
            if req.provenance_label:
                item.provenance_notes = f"{req.provenance_label} ({item.provenance_notes})" if item.provenance_notes else req.provenance_label

            out = service.ingest_observation(item)
            imported_ids.append(out.id)
            existing_urls.add(norm_url)
            if item.content_id:
                existing_ids.add(item.content_id.strip())

        # Create version checkpoint for the batch
        ver = service._checkpoint_strategy_version(
            "batch_import",
            f"Batch dataset import completed: {len(imported_ids)} posts added, {skipped_count} skipped.",
        )

        return BatchImportCommitResponse(
            imported_count=len(imported_ids),
            skipped_count=skipped_count,
            strategy_version=ver,
            message=f"Successfully imported {len(imported_ids)} observations (skipped {skipped_count} duplicates).",
            imported_ids=imported_ids,
        )
