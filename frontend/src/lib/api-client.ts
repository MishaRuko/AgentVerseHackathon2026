import { z } from 'zod';
import { filterSchema, workspaceInfoSchema, workspaceSchema } from './schemas';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/backend';

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const token = typeof window === 'undefined' ? '' : sessionStorage.getItem('workspace-token');
  const workspaceId = typeof window === 'undefined' ? '' : localStorage.getItem('workspace-id');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers,
      ...(workspaceId ? { 'X-Workspace-ID': workspaceId } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Server access denied. Check APP_TOKEN in the server configuration.');
    const error: unknown = await res.json().catch(() => null);
    throw new Error(error && typeof error === 'object' && 'detail' in error
      ? String(error.detail) : `Request failed (${res.status}). Please try again.`);
  }
  const result = schema.safeParse(await res.json());
  if (!result.success) throw new Error('The server returned an unexpected response. Please refresh.');
  return result.data;
}

const okSchema = z.object({ ok: z.boolean() });
export const apiClient = {
  baseUrl: BASE_URL,
  health: () => request('/health', z.object({ status: z.string() })),
  workspace: () => request('/api/workspace', workspaceSchema),
  workspaces: () => request('/api/workspaces', z.array(workspaceInfoSchema)),
  createWorkspace: (name: string) => request('/api/workspaces', workspaceInfoSchema,
    { method: 'POST', body: JSON.stringify({ name }) }),
  deleteWorkspace: (id: string) => request(`/api/workspaces/${id}`, okSchema, { method: 'DELETE' }),
  demo: () => request('/api/demo', okSchema, { method: 'POST' }),
  clearDemo: () => request('/api/demo/clear', okSchema, { method: 'POST' }),
  upload: (files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    return request('/api/upload', z.object({ imported: z.number(), warnings: z.array(z.string()) }),
      { method: 'POST', body });
  },
  enrich: (force = false) => request('/api/enrich',
    z.object({ queued: z.number(), already_analysed: z.boolean() }),
    { method: 'POST', body: JSON.stringify({ force }) }),
  sso: (id: string) => request(`/api/services/${id}/sso`, okSchema, { method: 'POST' }),
  retry: (id: string) => request(`/api/services/${id}/retry`, okSchema, { method: 'POST' }),
  edit: (id: string, data: { users?: number | null; spend?: number | null }) =>
    request(`/api/services/${id}`, okSchema, { method: 'PATCH', body: JSON.stringify(data) }),
  filter: (message: string) => request('/api/filter', filterSchema,
    { method: 'POST', body: JSON.stringify({ message }) }),
};
