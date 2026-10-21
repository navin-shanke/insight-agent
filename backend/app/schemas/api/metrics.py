"""Pydantic schemas for overview metrics API."""

from __future__ import annotations

from pydantic import BaseModel


class OverviewMetrics(BaseModel):
    active_tasks: int
    total_tasks: int
    tasks_completed: int
    tasks_partial: int
    tasks_failed: int
    tasks_cancelled: int
    total_discoveries: int
    total_reports: int
    scheduled_runs_total: int
    scheduled_runs_last_status: str | None
    scheduled_runs_last_at: str | None


class TaskStatusCounts(BaseModel):
    running: int
    completed: int
    partial: int
    failed: int
    cancelled: int
    pending: int
