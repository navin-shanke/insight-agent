import { apiClient } from './client';
import { ScheduledRun } from '../types';

export async function fetchSchedules(params?: { page?: number; page_size?: number }): Promise<{
  items: ScheduledRun[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const res = await apiClient.get('/schedules', { params });
  return res.data;
}

export async function fetchSchedule(id: string): Promise<ScheduledRun> {
  const res = await apiClient.get<ScheduledRun>(`/schedules/${id}`);
  return res.data;
}
