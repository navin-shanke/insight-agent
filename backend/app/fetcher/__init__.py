"""SSRF-safe URL fetching utilities."""

from .safe_fetch import (
    FetchResult,
    FetchError,
    fetch_url,
    normalize_url,
    validate_url,
    validate_hostname,
    is_blocked_ip,
    resolve_hostname,
    ALLOWED_SCHEMES,
    ALLOWED_CONTENT_TYPES,
    MAX_RESPONSE_BYTES,
    CONNECT_TIMEOUT,
    READ_TIMEOUT,
)

__all__ = [
    "FetchResult",
    "FetchError",
    "fetch_url",
    "normalize_url",
    "validate_url",
    "validate_hostname",
    "is_blocked_ip",
    "resolve_hostname",
    "ALLOWED_SCHEMES",
    "ALLOWED_CONTENT_TYPES",
    "MAX_RESPONSE_BYTES",
    "CONNECT_TIMEOUT",
    "READ_TIMEOUT",
]
