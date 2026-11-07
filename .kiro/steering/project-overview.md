# Project Overview

**Last Modified**: 2026-11-07
**Status**: Active - High-level project guide

---

## Quick Start

**AgentVerse Hackathon 2026** is a two-part project: a **Next.js frontend** and a
**separate, Dockerized backend** (stack still being decided). The two pieces are
developed independently and wired together for local development via Docker
Compose.

**Repository Layout**:

```
AgentVerseHackathon2026/
├── frontend/            # Next.js app (TypeScript, App Router, Tailwind)
├── backend/             # Dockerized backend service (stack TBD)
├── docker-compose.yml   # Wires frontend + backend for local dev
└── .kiro/
    ├── specs/           # Feature specifications
    └── steering/        # Project steering documents (this folder)
```

**Frontend Tech Stack**: Next.js 16 (App Router), React 19, TypeScript (strict),
Tailwind CSS v4, ESLint. Package manager: **npm**.

**Backend**: Not yet decided. Treated as a black box behind an HTTP API. It is
expected to run in a container and may be developed on a different machine. See
`backend-integration.md` for the contract the frontend relies on.

**Key Principles**:
- TypeScript everywhere it is practical.
- Frontend and backend are decoupled — they communicate only over HTTP.
- No AWS Amplify, no vendor lock-in assumptions. Keep the backend swappable.

---

## Division of Work

- **Frontend** (`frontend/`): Next.js app. Owned in this repo.
- **Backend** (`backend/`): Dockerized service, potentially authored on a
  collaborator's machine. The `backend/` folder here is a placeholder plus the
  integration contract until the real service lands.

Because the backend may arrive from elsewhere, the frontend must never import
backend source directly. All interaction goes through the HTTP API described in
`backend-integration.md`.

---

## Development Workflow

```bash
# Frontend only (fast inner loop)
cd frontend
npm install
npm run dev          # Next.js dev server on port 3000

# Full stack (once the backend container exists)
docker compose up    # from repo root
```

---

## Documentation Structure

**For detailed guidance, see**:
- **development-rules.md** — Coding standards, TypeScript rules, naming, docs
- **frontend-development.md** — Next.js, React, components, styling, testing
- **backend-integration.md** — How the frontend talks to the Dockerized backend

Feature specs live in `.kiro/specs/`.

---

**Document Version**: 1.0
**Last Updated**: 2026-11-07
**Status**: Active
