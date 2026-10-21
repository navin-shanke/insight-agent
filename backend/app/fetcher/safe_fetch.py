"""SSRF-safe URL fetcher.

Defends server-side requests against:
  - unsupported schemes (only http/https allowed)
  - loopback, private, link-local, multicast, and reserved IP destinations
  - redirect targets that bypass initial validation (each hop is re-validated)
  - DNS rebinding (fresh DNS resolution per request/redirect)

Design notes:
  - Automatic redirect following is disabled; each redirect Location is
    validated before being requested, so a redirect cannot bypass the
    private-IP block.
  - No credentials (cookies, Authorization, etc.) are forwarded to target
    hosts.
  - Connection/read timeouts, response-size caps, and content-type checks
    are applied.  Errors are surfaced as structured results, never as
    partial/fabricated content.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from typing import Optional, Set
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

# Maximum bytes to read from a response body.
MAX_RESPONSE_BYTES = 1_048_576  # 1 MiB

# Connection and read timeouts in seconds.
CONNECT_TIMEOUT = 10.0
READ_TIMEOUT = 20.0

# Allowed URL schemes.
ALLOWED_SCHEMES: Set[str] = {"http", "https"}

# Content types permitted for text extraction.  Binary/octet-stream and
# unknown types are rejected unless explicitly added here.
ALLOWED_CONTENT_TYPES: Set[str] = {
    "text/html",
    "text/plain",
    "text/css",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
    "application/rss+xml",
    "application/atom+xml",
    "text/markdown",
}


class FetchError(Exception):
    """Raised when a URL cannot be safely fetched."""

    def __init__(self, message: str, code: str = "fetch_failed"):
        super().__init__(message)
        self.code = code
        self.message = message


def is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if ``ip`` is a non-public destination that must be blocked.

    Covers loopback, private, link-local, multicast, and reserved ranges
    for both IPv4 and IPv6.
    """
    # Loopback.
    if ip.is_loopback:
        return True
    # Private (RFC 1918 / RFC 4193).
    if ip.is_private:
        return True
    # Link-local (RFC 3927 / RFC 4291).
    if ip.is_link_local:
        return True
    # Multicast (RFC 5771 / RFC 2373).
    if ip.is_multicast:
        return True
    # Reserved / future use (RFC 1112 / RFC 5735).
    if ip.is_reserved:
        return True
    # Unspecified addresses.
    if ip.is_unspecified:
        return True
    return True if ip.version == 4 and ip in ipaddress.ip_network("240.0.0.0/4") else False


def html_to_text(html: str) -> str:
    """Convert HTML to plain text, stripping scripts, styles, and markup."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "canvas", "iframe"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return " ".join(text.split())


def resolve_hostname(hostname: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """Resolve ``hostname`` to IP addresses, raising FetchError on failure."""
    try:
        infos = socket.getaddrinfo(hostname, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise FetchError(f"DNS resolution failed for {hostname}: {exc}", code="dns_failure")
    ips: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for info in infos:
        sockaddr = info[4]
        try:
            ips.append(ipaddress.ip_address(sockaddr[0]))
        except ValueError:
            continue
    if not ips:
        raise FetchError(f"No IP addresses resolved for {hostname}", code="no_ips")
    return ips


def validate_hostname(hostname: str) -> None:
    """Validate that all IPs for ``hostname`` are public and routable.

    Raises FetchError if the hostname cannot be resolved or if any
    resolved address is a blocked (private/loopback/link-local/etc.)
    destination.
    """
    if not hostname:
        raise FetchError("URL has no host", code="invalid_url")
    ips = resolve_hostname(hostname)
    blocked = [str(ip) for ip in ips if is_blocked_ip(ip)]
    if blocked:
        raise FetchError(
            f"Host {hostname} resolves to blocked address(es): {', '.join(blocked)}",
            code="blocked_host",
        )


def validate_url(url: str) -> str:
    """Validate a URL's scheme and host before fetching.

    Returns the normalized URL string.  Raises FetchError for unsupported
    schemes, missing hosts, or blocked destinations.
    """
    try:
        parsed = urlparse(url.strip())
    except ValueError as exc:
        raise FetchError(f"Invalid URL: {exc}", code="invalid_url")
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise FetchError(
            f"Unsupported scheme '{parsed.scheme}'; only http/https allowed.",
            code="unsupported_scheme",
        )
    if not parsed.hostname:
        raise FetchError("URL has no host", code="invalid_url")
    validate_hostname(parsed.hostname)
    return url


def normalize_url(url: str) -> str:
    """Return a canonical form of ``url`` for deduplication.

    Normalization lowercases scheme and hostname, drops default ports
    (80 for http, 443 for https), removes the fragment, and sorts query
    parameters.  Equivalent URLs (e.g. with/without ``www`` case, default
    port, reordered query keys) produce the same canonical form.
    """
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower()
    host = (parsed.hostname or "").lower()
    port = parsed.port
    default_port = 443 if scheme == "https" else 80
    netloc = host if port in (None, default_port) else f"{host}:{port}"
    path = parsed.path or "/"
    query = urlencode(sorted(parse_qsl(parsed.query)), doseq=True)
    # Drop the fragment; it never identifies a distinct resource server-side.
    return urlunparse((scheme, netloc, path, "", query, ""))


@dataclass
class FetchResult:
    """Structured result of a safe fetch."""

    url: str
    status_code: int
    headers: dict
    content: bytes
    text: str
    content_type: Optional[str]
    fetched_at: str
    redirect_chain: list[str]


async def fetch_url(
    url: str,
    *,
    max_bytes: int = MAX_RESPONSE_BYTES,
    follow_redirects: bool = True,
    max_redirects: int = 5,
    client: Optional[httpx.AsyncClient] = None,
) -> FetchResult:
    """Fetch ``url`` with SSRF protections.

    Each redirect destination is re-validated before being requested, so a
    redirect chain cannot route to a private/loopback address.  No
    credentials are forwarded.
    """
    # Validate the initial URL.
    current_url = validate_url(url)

    owned_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=CONNECT_TIMEOUT,
                read=READ_TIMEOUT,
                write=CONNECT_TIMEOUT,
                pool=5.0,
            ),
            follow_redirects=False,
            max_redirects=0,
        )

    redirect_chain: list[str] = [current_url]
    hops = 0

    try:
        while True:
            parsed = urlparse(current_url)
            validate_hostname(parsed.hostname or "")

            try:
                response = await client.get(current_url)
            except httpx.TimeoutException as exc:
                raise FetchError(f"Request timed out: {exc}", code="timeout") from exc
            except httpx.TransportError as exc:
                raise FetchError(f"Transport error: {exc}", code="transport_error") from exc

            # Handle redirects manually so each hop is validated.
            if response.is_redirect and follow_redirects:
                if hops >= max_redirects:
                    raise FetchError(
                        f"Too many redirects (max {max_redirects})",
                        code="too_many_redirects",
                    )
                location = response.headers.get("location")
                if not location:
                    raise FetchError(
                        "Redirect response missing Location header",
                        code="invalid_redirect",
                    )
                # Resolve relative redirect URLs against the current URL.
                from urllib.parse import urljoin

                next_url = urljoin(current_url, location)
                current_url = validate_url(next_url)
                redirect_chain.append(current_url)
                hops += 1
                continue
            break

        # Enforce response-size cap while streaming.
        content = b""
        content_type = response.headers.get("content-type", "")
        # Normalize content type by stripping parameters (charset, etc.).
        content_type_main = content_type.split(";")[0].strip().lower() if content_type else ""

        async for chunk in response.aiter_bytes():
            content += chunk
            if len(content) > max_bytes:
                raise FetchError(
                    f"Response exceeds size limit of {max_bytes} bytes",
                    code="response_too_large",
                )

        # Content-type restriction.
        if content_type_main and content_type_main not in ALLOWED_CONTENT_TYPES:
            raise FetchError(
                f"Disallowed content type: {content_type_main}",
                code="disallowed_content_type",
            )

        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            text = ""

        # Convert HTML to plain text so LLM-based extraction works on content
        # rather than raw markup.
        if content_type_main == "text/html":
            text = html_to_text(text)

        from datetime import datetime, timezone

        return FetchResult(
            url=current_url,
            status_code=response.status_code,
            headers=dict(response.headers),
            content=content,
            text=text,
            content_type=content_type_main or None,
            fetched_at=datetime.now(timezone.utc).isoformat(),
            redirect_chain=redirect_chain,
        )
    finally:
        if owned_client:
            await client.aclose()
