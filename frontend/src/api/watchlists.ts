import { apiClient } from './client';
import { Watchlist } from '../types';

export interface CreateWatchlistDto {
  name: string;
  topic: string;
  keywords?: string[];
  source_preferences?: string[];
  enabled?: boolean;
}

export async function fetchWatchlists(): Promise<{ items: Watchlist[]; total: number }> {
  const res = await apiClient.get('/watchlists');
  return res.data;
}

export async function createWatchlist(dto: CreateWatchlistDto): Promise<Watchlist> {
  const res = await apiClient.post<Watchlist>('/watchlists', dto);
  return res.data;
}

export async function updateWatchlist(id: string, dto: Partial<CreateWatchlistDto>): Promise<Watchlist> {
  const res = await apiClient.patch<Watchlist>(`/watchlists/${id}`, dto);
  return res.data;
}

export async function deleteWatchlist(id: string): Promise<void> {
  await apiClient.delete(`/watchlists/${id}`);
}
