# Backend (placeholder)

The backend stack is **not yet decided**. This folder is a placeholder until the
real Dockerized service lands — it may be authored on a collaborator's machine
and dropped in here, or built out in this repo later.

## Contract the frontend expects

The frontend treats the backend as a black box behind an HTTP/JSON API. The
current placeholder assumptions (update these when the real service exists):

| Item | Value (placeholder) |
|------|---------------------|
| Protocol | HTTP/JSON (REST) |
| Port | `8000` |
| Health check | `GET /health` → `200 { "status": "ok" }` |
| Auth | TBD |

See `.kiro/steering/backend-integration.md` for the full contract and the steps
to follow once the stack is chosen.

## What goes here

When the real backend arrives it must ship a `Dockerfile` so `docker compose up`
from the repo root can build and run it alongside the frontend. Until then, the
`backend` service in `docker-compose.yml` is a commented-out placeholder.

## Language

TypeScript is preferred for anything written in this repo, but the backend may be
a different language (Python, Go, etc.) if that is a deliberate choice — it is
decoupled, so the frontend does not care, as long as the HTTP contract holds.
