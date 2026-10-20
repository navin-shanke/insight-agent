"""Unit tests for SSRF-safe URL fetching and redirect protection.

Uses httpx.MockTransport so no real network is required.  Each redirect
destination is re-validated, so a redirect chain cannot route to a
private/loopback address.
"""

from __future__ import annotations

import asyncio
import ipaddress
import pytest
import httpx

from app.fetcher import validate_url, FetchError, is_blocked_ip, fetch_url


def test_validate_blocks_loopback_and_private_ips():
    for host in [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/",  # link-local / AWS metadata
        "http://224.0.0.1/",  # multicast
        "http://0.0.0.0/",  # unspecified
    ]:
        with pytest.raises(FetchError) as exc:
            validate_url(host)
        assert exc.value.code == "blocked_host", host


def test_validate_blocks_unsupported_schemes():
    for scheme in ["ftp", "file", "javascript", "data", "ws"]:
        with pytest.raises(FetchError) as exc:
            validate_url(f"{scheme}://example.com/")
        assert exc.value.code == "unsupported_scheme", scheme


def test_validate_allows_public_domain():
    # example.com resolves to a public IP; no network is made by validate_url.
    assert validate_url("https://example.com/") == "https://example.com/"
    assert validate_url("http://example.com/path?q=1") == "http://example.com/path?q=1"


def test_is_blocked_ip_covers_ranges():
    assert is_blocked_ip(ipaddress.ip_address("127.0.0.1"))
    assert is_blocked_ip(ipaddress.ip_address("10.0.0.1"))
    assert is_blocked_ip(ipaddress.ip_address("172.16.0.1"))
    assert is_blocked_ip(ipaddress.ip_address("192.168.1.1"))
    assert is_blocked_ip(ipaddress.ip_address("169.254.169.254"))
    assert is_blocked_ip(ipaddress.ip_address("224.0.0.1"))
    assert not is_blocked_ip(ipaddress.ip_address("93.184.216.34"))  # example.com


def _make_handler(redirect_to):
    calls = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        url = str(request.url)
        if url.startswith("http://example.com"):
            return httpx.Response(
                302, request=request, headers={"location": redirect_to}
            )
        return httpx.Response(200, request=request, text="ok")

    return handler, calls


async def _run_fetch(handler, calls, url):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        return await fetch_url(url, client=client)
    finally:
        await client.aclose()
    return None, calls


def test_fetch_redirect_to_private_is_blocked():
    handler, calls = _make_handler("http://127.0.0.1/admin")
    with pytest.raises(FetchError) as exc:
        asyncio.run(_run_fetch(handler, calls, "http://example.com/"))
    assert exc.value.code == "blocked_host"
    assert any("example.com" in c for c in calls)


def test_fetch_redirect_to_public_allowed():
    handler, calls = _make_handler("https://example.com/other")
    result = asyncio.run(_run_fetch(handler, calls, "http://example.com/"))
    assert result.status_code == 200
    assert result.text == "ok"
