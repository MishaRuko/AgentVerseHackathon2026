# Backend Integration Guide

The frontend and Python backend communicate only over HTTP/JSON. No shared runtime
or source imports. Use `frontend/src/lib/api-client.ts` for requests and Zod schemas
in `frontend/src/lib/schemas.ts` to validate every response.

## Runtime contract

- Backend: FastAPI, port 8000, `GET /health` returns `{"status":"ok"}`.
- Browser base: `/api/backend`; Next rewrites to `BACKEND_URL` (local default:
  `http://localhost:8000`, Docker build: `http://backend:8000`).
- `GET /api/workspace` is polled for persistent service/job updates.
- `POST /api/upload` accepts multipart `files` (CSV/XLSX).
- `POST /api/demo`, `/api/enrich`, `/api/services/{id}/sso` and
  `/api/services/{id}/retry` enqueue work; `PATCH /api/services/{id}` edits usage/spend.
- `POST /api/filter` accepts `{message}` and returns query/category/status/savings_only.
- Exact schemas are available at backend `/docs`; see `backend/README.md`.
- When `APP_TOKEN` is set, all `/api/` requests require a bearer token, entered
  through Settings and stored in sessionStorage. Never embed this token in a build.

## Background work

One separate Python worker consumes a SQLite-backed job queue. API and worker share
the named Docker volume. One worker per database; restart recovers interrupted work.
Raw SSO logs are synthetic and stay local. Gemini sees aggregate counts and
subscription metadata only. Missing provider configuration is a visible service error.

## Containers

`docker compose up --build` runs frontend, API and worker. Copy `.env.example` to
`.env`, provide the Gemini key when available, and set `APP_TOKEN` before public
deployment. Both published ports bind to loopback. Frontend uses a standalone Next
build. No SSH deployment is part of the initial implementation.
