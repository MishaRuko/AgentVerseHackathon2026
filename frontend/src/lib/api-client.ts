import type { HealthResponse } from '@/types';

/**
 * Single typed entry point for all backend calls. Keep the base URL, headers,
 * error handling, and response typing in one place. See
 * `.kiro/steering/backend-integration.md`.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text()}`);
  }

  return (await res.json()) as T;
}

export const apiClient = {
  baseUrl: BASE_URL,
  health: () => request<HealthResponse>('/health'),
};
