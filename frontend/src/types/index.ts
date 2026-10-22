export interface User {
  username: string;
}

export interface OverviewMetrics {
  active_tasks: number;
  total_tasks: number;
  tasks_completed: number;
  tasks_partial: number;
  tasks_failed: number;
  tasks_cancelled: number;
  total_discoveries: number;
  total_reports: number;
  scheduled_runs_total: number;
  scheduled_runs_last_status: string | null;
  scheduled_runs_last_at: string | null;
}

export interface ResearchSubmitRequest {
  query: string;
  source_budget?: number;
  max_iterations?: number;
  time_budget_seconds?: number;
  token_budget?: number;
}

export interface ResearchTask {
  task_id: string;
  query: string;
  status: 'running' | 'completed' | 'partial' | 'failed' | 'cancelled' | string;
  step?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  checkpoint_count?: number;
}

export interface ResearchProgressEvent {
  task_id: string;
  status: string;
  step: string;
  query: string;
  progress_pct: number;
  checkpoint?: number;
  timestamp: string;
  error?: string;
}

export interface DiscoverySource {
  source_id: string;
  url: string;
  title?: string | null;
  link_type?: string | null;
}

export interface Discovery {
  id: string;
  title: string;
  summary: string;
  category?: string | null;
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'DISPUTED' | string;
  relevance_score?: number | null;
  novelty_score?: number | null;
  evidence_quality_score?: number | null;
  usefulness_score?: number | null;
  created_at: string;
  updated_at: string;
  sources: DiscoverySource[];
}

export interface ReportFinding {
  id: string;
  claim_text: string;
  verification_status: string;
  category?: string | null;
  confidence_rationale?: string | null;
  source_url?: string | null;
  source_domain?: string | null;
  evidence_excerpts: string[];
}

export interface ReportSource {
  url: string;
  domain: string;
  title?: string | null;
}

export interface ReportMetrics {
  unique_sources_count: number;
  unique_domains_count: number;
  total_discoveries_count: number;
  total_claims_count: number;
  supported_count: number;
  partially_supported_count: number;
  contradicted_count: number;
  unverified_count: number;
}

export interface Report {
  id: string;
  title: string;
  query: string;
  summary?: string | null;
  limitations?: string | null;
  task_id?: string | null;
  created_at: string;
  updated_at: string;
  discovery_ids: string[];
  body_md?: string;
  executive_summary?: string | null;
  metrics?: ReportMetrics;
  findings?: ReportFinding[];
  sources?: ReportSource[];
}

export interface Evidence {
  id: string;
  claim_id: string;
  source_id: string;
  source_url?: string | null;
  source_title?: string | null;
  excerpt: string;
  stance: string;
  retrieved_at: string;
  independence_group?: string | null;
  quality_notes?: string | null;
}

export interface Claim {
  id: string;
  task_id?: string | null;
  text: string;
  category?: string | null;
  confidence?: number | null;
  created_at?: string | null;
  evidence: Evidence[];
}

export interface Watchlist {
  id: string;
  name: string;
  topic: string;
  keywords: string[];
  source_preferences: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledRun {
  id: string;
  task_id: string;
  schedule_key?: string | null;
  status: string;
  last_run_at?: string | null;
  next_run_at: string;
  error_summary?: string | null;
  digest_md?: string | null;
  coverage?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationService {
  name: string;
  status: 'connected' | 'disconnected' | 'unknown' | 'planned';
  detail?: string | null;
}

export interface TelegramConfig {
  enabled: boolean;
  configured: boolean;
  chat_id_masked?: string | null;
}

export interface InstagramMetrics {
  likes?: number | null;
  views?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
}

export interface InstagramObservation {
  id: string;
  source_url: string;
  account_handle?: string | null;
  content_id?: string | null;
  format: 'reel' | 'carousel' | 'image' | 'unknown';
  caption: string;
  hook: string;
  hook_type: string;
  hook_length_chars: number;
  hashtags: string[];
  posted_at?: string | null;
  observed_at: string;
  collection_method: 'user_url' | 'manual_entry' | 'dataset_export' | 'graph_api';
  provenance_notes?: string | null;
  metrics?: InstagramMetrics | null;
  notes?: string | null;
}

export interface PromisingPattern {
  id: string;
  pattern_title: string;
  description: string;
  format: string;
  sample_size: number;
  measured_outcome: string;
  confidence: 'low' | 'medium' | 'high';
  limitations: string;
  last_updated: string;
}

export interface TestedHypothesis {
  id: string;
  hypothesis: string;
  status: 'testing' | 'supported' | 'inconclusive' | 'refuted';
  sample_size: number;
  evidence_notes: string;
  last_evaluated_at: string;
}

export interface UserFeedbackItem {
  id: string;
  target_id: string;
  target_type: 'pattern' | 'experiment' | 'recommendation';
  action: 'accepted' | 'rejected' | 'modified';
  user_note?: string | null;
  created_at: string;
}

export interface InstagramRecommendation {
  id: string;
  title: string;
  category: 'content_theme' | 'opening_hook' | 'format_choice' | 'posting_window' | 'underperforming_pattern' | 'data_gap';
  priority: 'high' | 'medium' | 'low';
  what_to_do: string;
  why_recommended: string;
  supporting_evidence: string;
  confidence_and_limitations: string;
  expected_outcome: string;
  measurement_plan: string;
  contingency_plan: string;
  evidence_sample_size: number;
  status: 'active' | 'accepted' | 'rejected' | 'testing';
  created_at: string;
}

export interface InstagramStrategyVersionOut {
  version: number;
  change_trigger: string;
  change_summary: string;
  sample_size: number;
  created_at: string;
  snapshot?: any;
}

export interface SystemImprovementProposal {
  id: string;
  title: string;
  component: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  root_cause_analysis: string;
  candidate_patch_diff: string;
  verification_plan: string;
  risk_level: 'low' | 'medium' | 'high';
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  created_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface ProposalReviewIn {
  action: 'APPROVED' | 'REJECTED';
  review_notes?: string | null;
}

export interface InstagramStrategyProfile {
  version: number;
  sample_size: number;
  last_updated: string;
  promising_patterns: PromisingPattern[];
  tested_hypotheses: TestedHypothesis[];
  recommendations?: InstagramRecommendation[];
  user_feedback: UserFeedbackItem[];
  learning_notes: string[];
}

export interface InstagramExperiment {
  id: string;
  title: string;
  proposed_change: string;
  evidence_rationale: string;
  why_it_helps: string;
  evaluation_metric: string;
  sample_required: number;
  status: 'proposed' | 'active' | 'completed' | 'rejected';
  confidence: 'low' | 'medium' | 'high';
  baseline_summary?: string | null;
  outcome_summary?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface FormatBreakdown {
  format: string;
  count: number;
  percentage: number;
  avg_likes?: number | null;
  avg_views?: number | null;
}

export interface HookTypeBreakdown {
  hook_type: string;
  count: number;
  sample_examples: string[];
}

export interface InstagramPatternsResponse {
  total_observations: number;
  formats: FormatBreakdown[];
  hook_types: HookTypeBreakdown[];
  top_hashtags: { tag: string; count: number }[];
  disclaimer: string;
}

export interface BatchImportItemPreview {
  row_index: number;
  status: 'valid' | 'duplicate' | 'invalid';
  source_url?: string | null;
  account_handle?: string | null;
  content_id?: string | null;
  format: string;
  caption_preview?: string | null;
  metrics?: {
    likes?: number | null;
    views?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
  } | null;
  posted_at?: string | null;
  reasons: string[];
  parsed_observation?: any;
}

export interface BatchImportPreviewResponse {
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  items: BatchImportItemPreview[];
  can_commit: boolean;
  import_token: string;
}

export interface BatchImportCommitRequest {
  items: any[];
  provenance_label?: string;
  skip_duplicates?: boolean;
}

export interface BatchImportCommitResponse {
  imported_count: number;
  skipped_count: number;
  strategy_version: number;
  message: string;
  imported_ids: string[];
}
