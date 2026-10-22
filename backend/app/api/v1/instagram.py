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
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.api.v1.auth import get_current_user
from app.schemas.api.auth import TokenData
from app.schemas.api.instagram import (
    BatchImportCommitRequest,
    BatchImportCommitResponse,
    BatchImportPreviewResponse,
    FormatBreakdown,
    HookTypeBreakdown,
    InstagramExperimentIn,
    InstagramExperimentOut,
    InstagramFeedbackIn,
    InstagramObservationIn,
    InstagramObservationListResponse,
    InstagramObservationOut,
    InstagramPatternsResponse,
    InstagramRecommendation,
    InstagramStrategyProfile,
    InstagramStrategyVersionOut,
    ProposalReviewIn,
    SystemImprovementProposal,
    UserFeedbackItem,
)
from app.services.instagram_learning import InstagramLearningService
from app.services.instagram_batch import InstagramBatchService

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


@router.get(
    "/recommendations",
    response_model=List[InstagramRecommendation],
    summary="List prioritized recommendations with 7-point evidence and contingency plans",
)
async def list_recommendations(
    _user: TokenData = Depends(get_current_user),
) -> List[InstagramRecommendation]:
    svc = _get_service()
    return svc.get_recommendations()


@router.get(
    "/strategy/history",
    response_model=List[InstagramStrategyVersionOut],
    summary="View versioned history and audit trail of strategy profile adaptations",
)
async def get_strategy_history(
    _user: TokenData = Depends(get_current_user),
) -> List[InstagramStrategyVersionOut]:
    svc = _get_service()
    return svc.get_strategy_history()


@router.post(
    "/strategy/rollback/{version}",
    response_model=InstagramStrategyProfile,
    summary="Safely rollback to a previous strategy version",
)
async def rollback_strategy(
    version: int,
    _user: TokenData = Depends(get_current_user),
) -> InstagramStrategyProfile:
    svc = _get_service()
    profile = svc.rollback_strategy_version(version)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Strategy version {version} not found")
    return profile


@router.get(
    "/proposals",
    response_model=List[SystemImprovementProposal],
    summary="List Level B diagnostic proposed software improvements awaiting user review",
)
async def list_proposals(
    _user: TokenData = Depends(get_current_user),
) -> List[SystemImprovementProposal]:
    svc = _get_service()
    return svc.generate_diagnostic_proposals()


@router.post(
    "/proposals/{proposal_id}/review",
    response_model=SystemImprovementProposal,
    summary="Review (approve or reject) a proposed software improvement",
)
async def review_proposal(
    proposal_id: str,
    review: ProposalReviewIn,
    _user: TokenData = Depends(get_current_user),
) -> SystemImprovementProposal:
    svc = _get_service()
    updated = svc.review_improvement_proposal(proposal_id, review)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found")
    return updated


@router.post(
    "/batch/preview",
    response_model=BatchImportPreviewResponse,
    summary="Preview and validate CSV or JSON file upload before committing",
)
async def preview_batch_file(
    file: UploadFile = File(...),
    _user: TokenData = Depends(get_current_user),
) -> BatchImportPreviewResponse:
    content = await file.read()
    svc = _get_service()
    return InstagramBatchService.parse_raw_content(
        content_bytes=content,
        filename=file.filename or "upload.csv",
        service=svc,
    )


@router.post(
    "/batch/commit",
    response_model=BatchImportCommitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Atomically commit previewed observations into the learning dataset",
)
async def commit_batch_import(
    payload: BatchImportCommitRequest,
    _user: TokenData = Depends(get_current_user),
) -> BatchImportCommitResponse:
    svc = _get_service()
    return InstagramBatchService.commit_batch_import(payload, service=svc)
