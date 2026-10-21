"""Pydantic schemas for integrations status API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ServiceStatus(BaseModel):
    name: str
    status: str  # "connected" | "disconnected" | "unknown" | "planned"
    detail: Optional[str] = None


class IntegrationsStatusResponse(BaseModel):
    services: list[ServiceStatus]


class TelegramConfigOut(BaseModel):
    enabled: bool
    configured: bool  # True if bot_token and chat_id are non-empty
    chat_id_masked: Optional[str]  # e.g. "****5678"
