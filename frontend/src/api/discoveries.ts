import { apiClient } from './client';
import { Discovery } from '../types';

export interface DiscoveryFilterParams {
  page?: number;
  page_size?: number;
  category?: string;
  verification_status?: string;
  q?: string;
}

export async function fetchDiscoveries(params?: DiscoveryFilterParams): Promise<{
  items: Discovery[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const res = await apiClient.get('/discoveries', { params });
  return res.data;
}

export async function fetchDiscovery(id: string): Promise<Discovery> {
  const res = await apiClient.get<Discovery>(`/discoveries/${id}`);
  return res.data;
}
