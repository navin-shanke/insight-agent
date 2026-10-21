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
