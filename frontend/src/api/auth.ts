import { apiClient, setToken, clearToken, getToken } from './client';

export interface LoginParams {
  username: string;
  password: string;
}

export async function login(params: LoginParams): Promise<{ access_token: string }> {
  const formData = new URLSearchParams();
  formData.append('username', params.username);
  formData.append('password', params.password);

  const res = await apiClient.post<{ access_token: string }>('/auth/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  setToken(res.data.access_token);
  return res.data;
}

export function logout() {
  clearToken();
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
