"""Pydantic schemas for Instagram Adaptive Learning API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class InstagramMetrics(BaseModel):
    """Observed engagement metrics. Missing metrics are explicitly None — never inferred."""
    likes: Optional[int] = Field(default=None, description="Observed like count, or null if uncollected")
    views: Optional[int] = Field(default=None, description="Observed video/reel view count, or null")
    comments: Optional[int] = Field(default=None, description="Observed comment count, or null")
    shares: Optional[int] = Field(default=None, description="Observed share count, or null")
    saves: Optional[int] = Field(default=None, description="Observed save count, or null")


class InstagramObservationIn(BaseModel):
    """Input payload to ingest an Instagram post observation."""
    source_url: str = Field(..., description="Instagram post URL or permalink")
    account_handle: Optional[str] = Field(default=None, description="@handle or creator identifier")
    content_id: Optional[str] = Field(default=None, description="Platform shortcode or post ID")
    format: Literal["reel", "carousel", "image", "unknown"] = Field(
        default="unknown", description="Content format type"
    )
    caption: str = Field(..., description="Post caption text")
    hook: Optional[str] = Field(default=None, description="Opening line or hook (auto-extracted if omitted)")
    hashtags: List[str] = Field(default_factory=list, description="Extracted hashtags")
    posted_at: Optional[datetime] = Field(default=None, description="Post publication timestamp")
    collection_method: Literal["user_url", "manual_entry", "dataset_export", "graph_api"] = Field(
        default="user_url", description="Data provenance & collection mechanism"
    )
    provenance_notes: Optional[str] = Field(
        default=None, description="Data origin notes (e.g. 'User-provided CSV export row 4')"
    )
    metrics: Optional[InstagramMetrics] = Field(
        default=None, description="Observed metrics; missing fields must be null"
    )
    notes: Optional[str] = Field(default=None, description="Analyst observations or contextual notes")


class InstagramObservationOut(InstagramObservationIn):
    """Persisted observation record with timestamp and ID."""
    id: str
    observed_at: datetime
    hook_type: str = "statement"
    hook_length_chars: int = 0


class InstagramObservationListResponse(BaseModel):
    items: List[InstagramObservationOut]
    total: int


class PromisingPattern(BaseModel):
    """A content pattern showing promising results with sample size and limitations."""
    id: str
    pattern_title: str
    description: str
    format: str
    sample_size: int
    measured_outcome: str
    confidence: Literal["low", "medium", "high"]
    limitations: str
    last_updated: datetime


class TestedHypothesis(BaseModel):
    """A marketing/content hypothesis tested against observed posts."""
    id: str
    hypothesis: str
    status: Literal["testing", "supported", "inconclusive", "refuted"]
    sample_size: int
    evidence_notes: str
    last_evaluated_at: datetime


class UserFeedbackItem(BaseModel):
    """User feedback accepting, rejecting, or adjusting a recommendation or pattern."""
    id: str
    target_id: str
    target_type: Literal["pattern", "experiment", "recommendation"]
    action: Literal["accepted", "rejected", "modified"]
    user_note: Optional[str] = None
    created_at: datetime


class InstagramStrategyProfile(BaseModel):
    """Persistent, inspectable strategy profile for Instagram research."""
    version: int = 1
    sample_size: int = 0
    last_updated: datetime
    promising_patterns: List[PromisingPattern] = Field(default_factory=list)
    tested_hypotheses: List[TestedHypothesis] = Field(default_factory=list)
    recommendations: List[InstagramRecommendation] = Field(default_factory=list)
    user_feedback: List[UserFeedbackItem] = Field(default_factory=list)
    learning_notes: List[str] = Field(default_factory=list)


class InstagramExperimentIn(BaseModel):
    """Input payload to propose or record an experiment."""
    title: str
    proposed_change: str
    evidence_rationale: str
    why_it_helps: str
    evaluation_metric: str
    sample_required: int = Field(default=3, ge=1)
    status: Literal["proposed", "active", "completed", "rejected"] = "proposed"
    baseline_summary: Optional[str] = None
    outcome_summary: Optional[str] = None


class InstagramExperimentOut(InstagramExperimentIn):
    id: str
    confidence: Literal["low", "medium", "high"] = "medium"
    created_at: datetime
    completed_at: Optional[datetime] = None


class InstagramFeedbackIn(BaseModel):
    """Submit user feedback on an experiment or learned pattern."""
    target_id: str
    target_type: Literal["pattern", "experiment", "recommendation"]
    action: Literal["accepted", "rejected", "modified"]
    user_note: Optional[str] = None


class FormatBreakdown(BaseModel):
    format: str
    count: int
    percentage: float
    avg_likes: Optional[float] = None
    avg_views: Optional[float] = None


class HookTypeBreakdown(BaseModel):
    hook_type: str
    count: int
    sample_examples: List[str] = Field(default_factory=list)


class InstagramPatternsResponse(BaseModel):
    """Structured extraction of observed content patterns."""
    total_observations: int
    formats: List[FormatBreakdown]
    hook_types: List[HookTypeBreakdown]
    top_hashtags: List[dict]
    disclaimer: str


class InstagramRecommendation(BaseModel):
    """Actionable, prioritized recommendation with 7-point evidence and contingency structure."""
    id: str
    title: str
    category: Literal[
        "content_theme",
        "opening_hook",
        "format_choice",
        "posting_window",
        "underperforming_pattern",
        "data_gap",
    ]
    priority: Literal["high", "medium", "low"]
    what_to_do: str
    why_recommended: str
    supporting_evidence: str
    confidence_and_limitations: str
    expected_outcome: str
    measurement_plan: str
    contingency_plan: str
    evidence_sample_size: int
    status: Literal["active", "accepted", "rejected", "testing"] = "active"
    created_at: datetime


class InstagramStrategyVersionOut(BaseModel):
    """Versioned checkpoint of the adaptive strategy profile."""
    version: int
    change_trigger: str
    change_summary: str
    sample_size: int
    created_at: datetime
    snapshot: Optional[dict] = None


class SystemImprovementProposal(BaseModel):
    """Level B: Diagnostic proposed software improvement requiring explicit review."""
    id: str
    title: str
    component: str
    severity: Literal["info", "warning", "error", "critical"]
    root_cause_analysis: str
    candidate_patch_diff: str
    verification_plan: str
    risk_level: Literal["low", "medium", "high"]
    status: Literal["PENDING_REVIEW", "APPROVED", "REJECTED", "APPLIED"] = "PENDING_REVIEW"
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None


class ProposalReviewIn(BaseModel):
    action: Literal["APPROVED", "REJECTED"]
    review_notes: Optional[str] = None
