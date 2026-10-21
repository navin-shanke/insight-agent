import { apiClient } from './client';
import { IntegrationService, TelegramConfig } from '../types';

export async function fetchIntegrationsStatus(): Promise<{ services: IntegrationService[] }> {
  const res = await apiClient.get('/integrations/status');
  return res.data;
}

export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  const res = await apiClient.get('/integrations/telegram');
  return res.data;
}
