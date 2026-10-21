import { apiClient } from './client';
import { Evidence, Claim } from '../types';

export async function fetchEvidenceList(params?: { page?: number; page_size?: number; stance?: string }): Promise<{
  items: Evidence[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const res = await apiClient.get('/evidence', { params });
  return res.data;
}

export async function fetchClaims(params?: { page?: number; page_size?: number; q?: string }): Promise<{
  items: Claim[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const res = await apiClient.get('/evidence/claims', { params });
  return res.data;
}

export async function fetchClaim(claimId: string): Promise<Claim> {
  const res = await apiClient.get<Claim>(`/evidence/claims/${claimId}`);
  return res.data;
}
