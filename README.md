# AgentVerse Hackathon 2026

A two-part project: a **Next.js frontend** and a separate, **Dockerized backend**
(stack still being decided). The pieces are developed independently and wired
together for local development via Docker Compose.

## Layout

```
AgentVerseHackathon2026/
├── frontend/            # Next.js app (TypeScript, App Router, Tailwind v4)
├── backend/             # Dockerized backend service (stack TBD) — placeholder
├── docker-compose.yml   # Wires frontend + backend for local dev
└── .kiro/
    ├── specs/           # Feature specifications
    └── steering/        # Project conventions Kiro follows
```

## Frontend stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
ESLint. Package manager: **npm**.

## Getting started

Frontend (fast inner loop):

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Full stack (once the backend container exists):

```bash
docker compose up    # from the repo root
```

## Backend

The backend is not yet decided and may be authored on a collaborator's machine.
It is treated as a black box behind an HTTP/JSON API. See
[`backend/README.md`](./backend/README.md) and
[`.kiro/steering/backend-integration.md`](./.kiro/steering/backend-integration.md)
for the contract and the steps to follow once the stack is chosen.

## Conventions

Project conventions live in `.kiro/steering/`:

- `project-overview.md` — high-level guide
- `development-rules.md` — coding standards, TypeScript rules, docs policy
- `frontend-development.md` — Next.js / React / Tailwind patterns
- `backend-integration.md` — the frontend ↔ backend contract
