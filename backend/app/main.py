"""FastAPI application entry point.

Exposes health endpoints and API v1 routes. The research orchestration layer
is intentionally not added until the baseline (database + health) is verified.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=f"{settings.api_v1_prefix}/docs",
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )

    @app.get("/health/live", tags=["health"])
    async def health_live() -> dict[str, str]:
        """Liveness probe — indicates the application process is running."""
        return {"status": "alive"}

    @app.get("/health/ready", tags=["health"])
    async def health_ready() -> dict[str, str]:
        """Readiness probe — indicates the application can serve requests."""
        return {"status": "ready"}

    return app


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "insight_agent.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=(settings.app_env == "development"),
    )
