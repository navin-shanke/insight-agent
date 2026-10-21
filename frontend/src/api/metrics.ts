import { apiClient } from './client';
import { OverviewMetrics } from '../types';

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  const res = await apiClient.get<OverviewMetrics>('/metrics/overview');
  return res.data;
}
