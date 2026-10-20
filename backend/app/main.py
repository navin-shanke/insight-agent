"""FastAPI application entry point.

Exposes health endpoints and API v1 routes. The research orchestration layer
is intentionally not added until the baseline (database + health) is verified.
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

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


async def run_daily_discovery(
    query: str = "daily discovery",
    topics: list[str] | None = None,
    source_budget: int = 100,
    max_iterations: int = 5,
    token_budget: int = 50000,
) -> None:
    """Run a single daily discovery task."""
    from app.agents.graph import run_research

    from app.agents.service import ResearchService

    service = ResearchService(database_url="sqlite:///./data/insight.db")

    state = await run_research(
        service,
        task_id=uuid.uuid4(),
        query=query,
        topics=topics,
        lookback_hours=24,
        source_budget=source_budget,
        token_budget=token_budget,
        max_iterations=max_iterations,
    )

    print(f"Daily discovery complete.")
    print(f"  Status: {state.get('status')}")
    print(f"  Discoveries: {len(state.get('discovery_ids', []))}")
    print(f"  Claims: {len(state.get('claims', []))}")
    print(f"  Report ID: {state.get('report_id')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Insight Agent")
    subparsers = parser.add_subparsers(dest="command")

    # serve command
    subparsers.add_parser("serve", help="Run the FastAPI API server")

    # daily-discovery command
    pd = subparsers.add_parser("daily-discovery", help="Run a daily discovery task")
    pd.add_argument("--query", default="daily discovery", help="Research query")
    pd.add_argument("--topics", nargs="*", default=None, help="Topics to research")
    pd.add_argument("--source-budget", type=int, default=100, help="Source budget")
    pd.add_argument("--max-iterations", type=int, default=5, help="Max iterations")
    pd.add_argument("--token-budget", type=int, default=50000, help="Token budget")

    args = parser.parse_args()

    if args.command == "serve":
        main()
    elif args.command == "daily-discovery":
        asyncio.run(
            run_daily_discovery(
                query=args.query,
                topics=args.topics,
                source_budget=args.source_budget,
                max_iterations=args.max_iterations,
                token_budget=args.token_budget,
            )
        )
    else:
        parser.print_help()
