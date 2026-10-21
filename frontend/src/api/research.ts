import { apiClient, getToken } from './client';
import { ResearchSubmitRequest, ResearchTask, ResearchProgressEvent } from '../types';

export async function submitResearch(req: ResearchSubmitRequest): Promise<ResearchTask> {
  const res = await apiClient.post<ResearchTask>('/research', req);
  return res.data;
}

export async function fetchResearchTasks(): Promise<{ tasks: ResearchTask[]; total: number }> {
  const res = await apiClient.get<{ tasks: ResearchTask[]; total: number }>('/research');
  return res.data;
}

export async function fetchResearchTask(taskId: string): Promise<ResearchTask> {
  const res = await apiClient.get<ResearchTask>(`/research/${taskId}`);
  return res.data;
}

export async function cancelResearchTask(taskId: string): Promise<{ accepted: boolean; message: string }> {
  const res = await apiClient.delete<{ task_id: string; accepted: boolean; message: string }>(
    `/research/${taskId}/cancel`
  );
  return res.data;
}

export function subscribeResearchProgress(
  taskId: string,
  onEvent: (event: ResearchProgressEvent) => void,
  onError?: (err: any) => void
): () => void {
  const token = getToken();
  // Standard EventSource does not support Authorization headers easily,
  // but we can pass token via query param or fetch event-stream.
  // We will use native fetch with ReadableStream for SSE with Bearer auth!
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`/api/v1/research/${taskId}/progress`, {
        signal: controller.signal,
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: 'text/event-stream',
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to stream progress: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          const dataMatch = block.match(/data:\s*(.+)/);
          if (dataMatch && dataMatch[1]) {
            try {
              const parsed = JSON.parse(dataMatch[1]);
              onEvent(parsed);
            } catch {
              // ignore ping or non-json
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && onError) {
        onError(err);
      }
    }
  })();

  return () => {
    controller.abort();
  };
}
