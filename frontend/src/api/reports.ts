import { apiClient } from './client';
import { Report } from '../types';

export interface ReportFilterParams {
  page?: number;
  page_size?: number;
  q?: string;
}

export async function fetchReports(params?: ReportFilterParams): Promise<{
  items: Report[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const res = await apiClient.get('/reports', { params });
  return res.data;
}

export async function fetchReport(id: string): Promise<Report> {
  const res = await apiClient.get<Report>(`/reports/${id}`);
  return res.data;
}
