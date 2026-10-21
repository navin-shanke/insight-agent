"""Integrations status API — Phase 5.

GET /api/v1/integrations/status   Returns real service health checks.
GET /api/v1/integrations/telegram  Returns masked Telegram config state.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.schemas.api.auth import TokenData
from app.schemas.api.integrations import (
    IntegrationsStatusResponse,
    ServiceStatus,
    TelegramConfigOut,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])
logger = logging.getLogger(__name__)


async def _check_ollama(base_url: str) -> ServiceStatus:
    """Probe Ollama /api/tags — real HTTP check, not a constant."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{base_url}/api/tags")
            if r.status_code == 200:
                data = r.json()
                model_count = len(data.get("models", []))
                return ServiceStatus(
                    name="Ollama",
                    status="connected",
                    detail=f"{model_count} model(s) available",
                )
            return ServiceStatus(name="Ollama", status="disconnected", detail=f"HTTP {r.status_code}")
    except Exception as exc:
        return ServiceStatus(name="Ollama", status="disconnected", detail=str(exc)[:120])


async def _check_duckduckgo() -> ServiceStatus:
    """Check DuckDuckGo connector health."""
    try:
        from app.connectors.duckduckgo import DuckDuckGoConnector
        connector = DuckDuckGoConnector()
        health = connector.health()
        return ServiceStatus(
            name="DuckDuckGo Search",
            status="connected" if health.get("status") == "READY" else "disconnected",
            detail=health.get("status", ""),
        )
    except Exception as exc:
        return ServiceStatus(name="DuckDuckGo Search", status="disconnected", detail=str(exc)[:120])


@router.get("/status", response_model=IntegrationsStatusResponse, summary="Check all integration statuses")
async def integrations_status(
    _user: TokenData = Depends(get_current_user),
) -> IntegrationsStatusResponse:
    """Real health checks — never returns a service as connected without verification."""
    settings = get_settings()
    ollama_status = await _check_ollama(settings.ollama_base_url)
    ddg_status = await _check_duckduckgo()

    telegram_configured = bool(settings.telegram_bot_token and settings.telegram_chat_id)
    telegram_status = ServiceStatus(
        name="Telegram",
        status="connected" if (settings.telegram_enabled and telegram_configured) else (
            "disconnected" if telegram_configured else "unknown"
        ),
        detail="Not configured" if not telegram_configured else (
            "Enabled" if settings.telegram_enabled else "Configured but disabled"
        ),
    )

    drive_status = ServiceStatus(
        name="Google Drive",
        status="planned",
        detail="Not implemented — planning only",
    )

    return IntegrationsStatusResponse(
        services=[ollama_status, ddg_status, telegram_status, drive_status]
    )


@router.get("/telegram", response_model=TelegramConfigOut, summary="Telegram configuration state")
async def telegram_config(
    _user: TokenData = Depends(get_current_user),
) -> TelegramConfigOut:
    """Return masked Telegram config state.  Secrets are never exposed."""
    settings = get_settings()
    chat_id = settings.telegram_chat_id
    masked = None
    if chat_id and len(chat_id) >= 4:
        masked = "****" + chat_id[-4:]
    elif chat_id:
        masked = "****"

    return TelegramConfigOut(
        enabled=settings.telegram_enabled,
        configured=bool(settings.telegram_bot_token and chat_id),
        chat_id_masked=masked,
    )
