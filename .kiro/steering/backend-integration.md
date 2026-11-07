# Backend Integration Guide

**Last Modified**: 2026-11-07
**Status**: Active - Frontend ↔ backend contract

---

## Table of Contents

1. [Principle](#principle)
2. [The Contract](#the-contract)
3. [Typed API Client](#typed-api-client)
4. [Environment Configuration](#environment-configuration)
5. [Local Development with Docker Compose](#local-development-with-docker-compose)
6. [When the Backend Stack Is Chosen](#when-the-backend-stack-is-chosen)

---

## Principle

The backend is a **black box behind an HTTP API**. Its language and framework are
not yet decided and may be developed on a collaborator's machine. The frontend
must not depend on anything but the HTTP contract below.

- No importing backend source into the frontend.
- No shared in-process runtime.
- The API is the only coupling point — keep it documented and typed.

---

## The Contract

Until the real backend lands, these are the placeholder assumptions. Update this
file the moment the real contract is known.

| Item | Value (placeholder) |
|------|---------------------|
| Protocol | HTTP/JSON (REST) |
| Backend container port | `8000` |
| Base URL (local, from browser) | `http://localhost:8000` |
| Base URL (frontend → backend inside Compose) | `http://backend:8000` |
| Health check | `GET /health` → `200 { "status": "ok" }` |
| Auth | TBD (none yet) |

**Note on base URLs**: in Docker Compose, the browser reaches the backend via
`localhost:8000` (published port), but server-side Next.js code running inside
the `frontend` container reaches it via the service name `http://backend:8000`.
Keep both in mind when choosing which env var to read.

---

## Typed API Client

All backend calls go through one client so the base URL, headers, error handling,
and types stay consistent. Create `frontend/src/lib/api-client.ts` when the first
real call is needed. Skeleton:

```typescript
import type { Agent } from '@/types';

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
  health: () => request<{ status: string }>('/health'),
  listAgents: () => request<Agent[]>('/agents'),
};
```

- Narrow/validate responses at this boundary rather than trusting them blindly.
- Keep shared types (`Agent`, etc.) in `frontend/src/types/`.

---

## Environment Configuration

Frontend reads the backend location from an env var — never hardcode it in
components.

- `frontend/.env.example` documents the keys; copy it to `.env.local` for real
  values. `.env*` is gitignored.
- Browser-exposed vars **must** start with `NEXT_PUBLIC_`.

```bash
# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Local Development with Docker Compose

`docker-compose.yml` at the repo root wires the two services. Until the backend
image exists, the `backend` service is a placeholder and may be commented out or
fail to start — that is expected. Run the frontend alone during early work:

```bash
cd frontend && npm run dev          # frontend only
# or, once backend is real:
docker compose up                   # full stack from repo root
```

---

## When the Backend Stack Is Chosen

Do these, in order, and update this file:

1. Replace `backend/` placeholder with the real service (or have the collaborator
   drop it in). It must ship a `Dockerfile`.
2. Fill in the real contract table above: port, routes, auth, payload shapes.
3. Add the shared response types to `frontend/src/types/` and flesh out
   `api-client.ts`.
4. Wire the real `backend` service in `docker-compose.yml` (build context, port
   mapping, env).
5. Confirm `GET /health` works through the client end to end.

---

**Document Version**: 1.0
**Last Updated**: 2026-11-07
**Status**: Active
