"""FastAPI application factory and CLI entry points for research workers.

Phase 5 additions:
- CORS middleware for the Vite dashboard frontend
- Full Phase 5 REST API mounted under /api/v1
- Improved /health/ready that probes real dependencies
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=f"{settings.api_v1_prefix}/docs",
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )

    # CORS -- allow the Vite dev server and any configured production origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.frontend_origin,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Phase 5 REST API
    from app.api.v1.router import router as api_router
    app.include_router(api_router)

    @app.get("/health/live", tags=["health"])
    async def health_live() -> dict[str, str]:
        """Liveness probe -- indicates the application process is running."""
        return {"status": "alive"}

    @app.get("/health/ready", tags=["health"])
    async def health_ready() -> dict[str, str]:
        """Readiness probe -- probes real dependencies.

        Returns 'degraded' when Ollama or DuckDuckGo are unavailable rather
        than a constant success response.
        """
        import httpx
        checks: dict[str, str] = {}

        # Ollama probe
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                r = await client.get(f"{settings.ollama_base_url}/api/tags")
                checks["ollama"] = "ready" if r.status_code == 200 else "unavailable"
        except Exception:
            checks["ollama"] = "unavailable"

        # DuckDuckGo probe
        try:
            from app.connectors.duckduckgo import DuckDuckGoConnector
            h = DuckDuckGoConnector().health()
            checks["duckduckgo"] = "ready" if h.get("status") == "READY" else "unavailable"
        except Exception:
            checks["duckduckgo"] = "unavailable"

        all_ready = all(v == "ready" for v in checks.values())
        return {"status": "ready" if all_ready else "degraded", **checks}

    return app


app = create_app()


def serve_api() -> None:
    """Start the FastAPI application using the configured Uvicorn settings."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=(settings.app_env == "development"),
    )


async def run_daily_discovery(
    query: str | None = None,
    topics: list[str] | None = None,
    source_budget: int = 100,
    max_iterations: int = 5,
    time_budget_seconds: int | None = None,
    token_budget: int = 50000,
) -> None:
    """Run bounded daily discovery through watchlists and scheduler locking."""
    from app.agents.service import ResearchService
    from app.services.scheduler import SchedulerService
    from app.core.config import get_settings

    settings = get_settings()
    database_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    service = ResearchService(database_url=database_url)
    result = await SchedulerService(service).run_daily_discovery(
        query=query,
        topics=topics,
        source_budget=source_budget,
        max_iterations=max_iterations,
        time_budget_seconds=time_budget_seconds,
        token_budget=token_budget,
    )

    print("Daily discovery finished.")
    print(f"  Status: {result.get('status')}")
    print(f"  Coverage: {result.get('coverage', {})}")
    for run in result.get("runs", []):
        if run.get("task_id"):
            print(f"  Task UUID: {run['task_id']}")
    if result.get("digest_md"):
        print(result["digest_md"])


async def run_daily_scheduler() -> None:
    """Keep the daily Phase 4 worker scheduled at the configured local time."""
    from app.agents.service import ResearchService
    from app.services.scheduler import SchedulerService

    settings = get_settings()
    if not settings.daily_discovery_enabled:
        raise RuntimeError("Daily discovery is disabled by DAILY_DISCOVERY_ENABLED")
    database_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    scheduler = SchedulerService(ResearchService(database_url=database_url))
    await scheduler.run_forever(
        hour=settings.daily_discovery_hour,
        minute=settings.daily_discovery_minute,
    )


def cancel_research_task(task_id: str) -> None:
    """Persist a cooperative cancellation request for a running task UUID."""
    from app.agents.service import ResearchService

    task_uuid = uuid.UUID(task_id)
    settings = get_settings()
    database_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    accepted = ResearchService(database_url=database_url).request_cancellation(task_uuid)
    print("Cancellation request recorded." if accepted else "Cancellation was already requested.")


def list_running_research_tasks() -> None:
    """Print durable running task IDs for the local cancel command."""
    from app.agents.service import ResearchService

    settings = get_settings()
    database_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    tasks = ResearchService(database_url=database_url).list_running_tasks()
    if not tasks:
        print("No running research tasks.")
    for task in tasks:
        print(f"{task['task_id']}  {task.get('step')}  {task.get('query')}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Insight Agent")
    subparsers = parser.add_subparsers(dest="command")

    # serve command
    subparsers.add_parser("serve", help="Run the FastAPI API server")

    # daily-discovery command
    pd = subparsers.add_parser("daily-discovery", help="Run a daily discovery task")
    pd.add_argument("--query", default=None, help="Optional additional research query")
    pd.add_argument("--topics", nargs="*", default=None, help="Topics to research")
    pd.add_argument("--source-budget", type=int, default=100, help="Source budget")
    pd.add_argument("--max-iterations", type=int, default=5, help="Max iterations")
    pd.add_argument(
        "--time-budget-seconds", type=int, default=None,
        help="Maximum run duration (capped at 45 minutes)",
    )
    pd.add_argument(
        "--token-budget", type=int, default=50000,
        help="Maximum reported Ollama tokens across this run",
    )

    # long-running daily worker
    subparsers.add_parser("scheduler", help="Run daily discovery every day at the configured local time")
    cancel_parser = subparsers.add_parser("cancel-research", help="Cancel a running research job cooperatively")
    cancel_parser.add_argument("task_id", help="Task UUID from list-running-research")
    subparsers.add_parser("list-running-research", help="List checkpointed running tasks and their UUIDs")

    return parser


def main(argv: list[str] | None = None) -> None:
    """Dispatch the installed console command and ``python -m app.main`` CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)

    # Preserve the historical no-argument behavior while allowing the
    # installed entry point to dispatch all documented subcommands.
    if args.command in (None, "serve"):
        serve_api()
    elif args.command == "daily-discovery":
        asyncio.run(
            run_daily_discovery(
                query=args.query,
                topics=args.topics,
                source_budget=args.source_budget,
                max_iterations=args.max_iterations,
                time_budget_seconds=args.time_budget_seconds,
                token_budget=args.token_budget,
            )
        )
    elif args.command == "scheduler":
        asyncio.run(run_daily_scheduler())
    elif args.command == "cancel-research":
        cancel_research_task(args.task_id)
    elif args.command == "list-running-research":
        list_running_research_tasks()


if __name__ == "__main__":
    main()
