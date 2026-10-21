"""Instagram Adaptive Learning API — Phase 5.

Provides endpoints for:
- Ingesting Instagram observations with explicit provenance and missing-metric tracking
- Extracting format and hook patterns without speculative inferences
- Fetching and updating the adaptive strategy profile
- Submitting explainable experiments and recording measured outcomes
- Recording user accept/reject feedback
"""

from __future__ import annotations

from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.v1.auth import get_current_user
from app.schemas.api.auth import TokenData
from app.schemas.api.instagram import (
    InstagramExperimentIn,
    InstagramExperimentOut,
    InstagramFeedbackIn,
    InstagramObservationIn,
    InstagramObservationListResponse,
    InstagramObservationOut,
    InstagramPatternsResponse,
    InstagramStrategyProfile,
    UserFeedbackItem,
)
from app.services.instagram_learning import InstagramLearningService

router = APIRouter(prefix="/instagram", tags=["instagram"])


def _get_service() -> InstagramLearningService:
    return InstagramLearningService()


@router.get(
    "/observations",
    response_model=InstagramObservationListResponse,
    summary="List observed Instagram posts and provenance",
)
async def list_observations(
    limit: int = Query(default=50, ge=1, le=500),
    _user: TokenData = Depends(get_current_user),
) -> InstagramObservationListResponse:
    svc = _get_service()
    items = svc.list_observations(limit=limit)
    return InstagramObservationListResponse(items=items, total=len(items))


@router.post(
    "/ingest",
    response_model=List[InstagramObservationOut],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest one or multiple Instagram observations with data provenance",
)
async def ingest_observations(
    payload: Union[InstagramObservationIn, List[InstagramObservationIn]],
    _user: TokenData = Depends(get_current_user),
) -> List[InstagramObservationOut]:
    svc = _get_service()
    items = payload if isinstance(payload, list) else [payload]
    results = []
    for item in items:
        out = svc.ingest_observation(item)
        results.append(out)
    return results


@router.get(
    "/patterns",
    response_model=InstagramPatternsResponse,
    summary="Extracted content patterns, format breakdowns, and hooks",
)
async def get_patterns(
    _user: TokenData = Depends(get_current_user),
) -> InstagramPatternsResponse:
    svc = _get_service()
    return svc.get_patterns()


@router.get(
    "/strategy",
    response_model=InstagramStrategyProfile,
    summary="Inspect persistent Instagram strategy profile and tested hypotheses",
)
async def get_strategy(
    _user: TokenData = Depends(get_current_user),
) -> InstagramStrategyProfile:
    svc = _get_service()
    return svc.get_strategy_profile()


@router.post(
    "/feedback",
    response_model=UserFeedbackItem,
    status_code=status.HTTP_201_CREATED,
    summary="Submit user feedback accepting, rejecting, or adjusting learned preferences",
)
async def record_feedback(
    feedback: InstagramFeedbackIn,
    _user: TokenData = Depends(get_current_user),
) -> UserFeedbackItem:
    svc = _get_service()
    return svc.record_feedback(feedback)


@router.get(
    "/experiments",
    response_model=List[InstagramExperimentOut],
    summary="List recommended and active experiments",
)
async def list_experiments(
    _user: TokenData = Depends(get_current_user),
) -> List[InstagramExperimentOut]:
    svc = _get_service()
    return svc.list_experiments()


@router.post(
    "/experiments",
    response_model=InstagramExperimentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create or propose an explainable experiment",
)
async def create_experiment(
    experiment: InstagramExperimentIn,
    _user: TokenData = Depends(get_current_user),
) -> InstagramExperimentOut:
    svc = _get_service()
    return svc.create_experiment(experiment)


@router.patch(
    "/experiments/{exp_id}/outcome",
    response_model=InstagramExperimentOut,
    summary="Record measured outcome for an experiment",
)
async def record_experiment_outcome(
    exp_id: str,
    outcome_summary: str = Query(..., description="Measured outcome summary"),
    status: str = Query(default="completed", description="Target status"),
    _user: TokenData = Depends(get_current_user),
) -> InstagramExperimentOut:
    svc = _get_service()
    updated = svc.record_experiment_outcome(exp_id, outcome_summary=outcome_summary, status=status)
    if not updated:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return updated
