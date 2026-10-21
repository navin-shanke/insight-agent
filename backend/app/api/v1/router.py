"""API v1 router — mounts all Phase 5 sub-routers under /api/v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, research, metrics, discoveries, reports, evidence, watchlists, schedules, integrations

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(research.router)
router.include_router(metrics.router)
router.include_router(discoveries.router)
router.include_router(reports.router)
router.include_router(evidence.router)
router.include_router(watchlists.router)
router.include_router(schedules.router)
router.include_router(integrations.router)
