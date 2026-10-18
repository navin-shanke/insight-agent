"""Unit tests for canonical URL normalization and deduplication."""

import pytest

from app.fetcher import normalize_url


def test_normalize_lowercases_scheme_and_host():
    assert normalize_url("HTTPS://Example.COM/page") == normalize_url("https://example.com/page")


def test_normalize_removes_default_port():
    assert normalize_url("https://example.com:443/page") == normalize_url("https://example.com/page")
    assert normalize_url("http://example.com:80/page") == normalize_url("http://example.com/page")


def test_normalize_keeps_nondefault_port():
    assert normalize_url("https://example.com:8443/page") == "https://example.com:8443/page"


def test_normalize_removes_fragment():
    assert normalize_url("https://example.com/page#section") == normalize_url("https://example.com/page")


def test_normalize_sorts_query_parameters():
    a = normalize_url("https://example.com/search?q=1&b=2")
    b = normalize_url("https://example.com/search?b=2&q=1")
    assert a == b


def test_normalize_dedup_equivalent_urls():
    variants = [
        "HTTPS://Example.COM:443/search?q=1&b=2#frag",
        "https://example.com/search?b=2&q=1",
        "https://example.com:443/search?q=1&b=2",
    ]
    canonicals = {normalize_url(v) for v in variants}
    assert len(canonicals) == 1


def test_normalize_distinct_urls_stay_distinct():
    assert normalize_url("https://example.com/a") != normalize_url("https://example.com/b")
    assert normalize_url("https://example.com?q=1") != normalize_url("https://example.com?q=2")


def test_normalize_path_preserved_case_sensitive():
    # URL paths are case-sensitive; only scheme/host are lowercased.
    assert normalize_url("https://Example.COM/Deep/Link/Page") == "https://example.com/Deep/Link/Page"
