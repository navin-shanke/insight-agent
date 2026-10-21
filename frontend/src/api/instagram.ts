import { apiClient } from './client';
import {
  InstagramExperiment,
  InstagramObservation,
  InstagramPatternsResponse,
  InstagramStrategyProfile,
  UserFeedbackItem,
} from '../types';

export interface IngestPayload {
  source_url: string;
  account_handle?: string;
  content_id?: string;
  format?: 'reel' | 'carousel' | 'image' | 'unknown';
  caption: string;
  hook?: string;
  hashtags?: string[];
  posted_at?: string;
  collection_method?: 'user_url' | 'manual_entry' | 'dataset_export' | 'graph_api';
  provenance_notes?: string;
  metrics?: {
    likes?: number | null;
    views?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
  };
  notes?: string;
}

export async function fetchInstagramObservations(limit: number = 50): Promise<{
  items: InstagramObservation[];
  total: number;
}> {
  const res = await apiClient.get('/instagram/observations', { params: { limit } });
  return res.data;
}

export async function ingestInstagramObservation(payload: IngestPayload | IngestPayload[]): Promise<InstagramObservation[]> {
  const res = await apiClient.post<InstagramObservation[]>('/instagram/ingest', payload);
  return res.data;
}

export async function fetchInstagramPatterns(): Promise<InstagramPatternsResponse> {
  const res = await apiClient.get<InstagramPatternsResponse>('/instagram/patterns');
  return res.data;
}

export async function fetchInstagramStrategy(): Promise<InstagramStrategyProfile> {
  const res = await apiClient.get<InstagramStrategyProfile>('/instagram/strategy');
  return res.data;
}

export async function submitInstagramFeedback(feedback: {
  target_id: string;
  target_type: 'pattern' | 'experiment' | 'recommendation';
  action: 'accepted' | 'rejected' | 'modified';
  user_note?: string;
}): Promise<UserFeedbackItem> {
  const res = await apiClient.post<UserFeedbackItem>('/instagram/feedback', feedback);
  return res.data;
}

export async function fetchInstagramExperiments(): Promise<InstagramExperiment[]> {
  const res = await apiClient.get<InstagramExperiment[]>('/instagram/experiments');
  return res.data;
}

export async function createInstagramExperiment(exp: {
  title: string;
  proposed_change: string;
  evidence_rationale: string;
  why_it_helps: string;
  evaluation_metric: string;
  sample_required?: number;
  baseline_summary?: string;
}): Promise<InstagramExperiment> {
  const res = await apiClient.post<InstagramExperiment>('/instagram/experiments', exp);
  return res.data;
}

export async function recordExperimentOutcome(
  expId: string,
  outcomeSummary: string,
  status: string = 'completed'
): Promise<InstagramExperiment> {
  const res = await apiClient.patch<InstagramExperiment>(`/instagram/experiments/${expId}/outcome`, null, {
    params: { outcome_summary: outcomeSummary, status },
  });
  return res.data;
}
