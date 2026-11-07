# Development Rules and Standards

**Last Modified**: 2026-11-07
**Status**: Active - Quick reference and code quality standards

---

## Table of Contents

1. [Core Development Rules](#core-development-rules)
2. [TypeScript Standards](#typescript-standards)
3. [Code Quality](#code-quality)
4. [Documentation Rules](#documentation-rules)
5. [Security](#security)

---

## Core Development Rules

### TypeScript Where Practical

**RULE**: Use TypeScript for all new frontend code. For backend code written in
this repo, prefer TypeScript too; if the backend is authored in another language
(Python, Go, etc.), that is a deliberate per-service choice, not the default.

### Port Management

**RULE**: Frontend dev server runs on port **3000**. Kill any stale process on
that port before starting.

```bash
lsof -ti:3000 && kill -9 $(lsof -ti:3000)
cd frontend && npm run dev
```

Backend containers should expose a documented, stable port (see
`backend-integration.md`). Avoid clashing with 3000.

### Frontend / Backend Boundary

**RULE**: The frontend communicates with the backend **only over HTTP**. Never
import backend source into the frontend or assume a shared runtime. The API
contract is the only coupling point.

### Command Output Management

**RULE**: Use `.kiro/temp/` for scratch command output, and clean up after. Keep
`.kiro/temp/` out of version control.

### Environment Variables

**RULE**: Never commit secrets. Keep real values in `.env.local` (frontend) or an
untracked `.env` (backend/compose). Commit `.env.example` files documenting the
required keys with placeholder values.

- Frontend browser-exposed vars **must** be prefixed `NEXT_PUBLIC_`.
- Anything without that prefix stays server-side only — keep secrets unprefixed.

---

## TypeScript Standards

### Type Safety Requirements

- **Strict Mode**: Keep `strict: true` on (already set in `frontend/tsconfig.json`).
- **No `any`**: Avoid `any`; use precise types or `unknown` with narrowing.
- **Interfaces for data**: Define interfaces/types for all data structures,
  especially API request/response shapes.
- **Type Guards**: Validate external data (API responses) at the boundary rather
  than trusting it.

### Naming Conventions

- **Variables/Functions**: camelCase (`getUserDetails`, `fetchAgents`)
- **Types/Interfaces**: PascalCase (`User`, `AgentRequest`, `ApiResponse`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_PAGE_SIZE`)
- **Files**: kebab-case (`agent-card.tsx`, `api-client.ts`)
- **Directories**: kebab-case (`agent-flow`, `user-management`)

### Code Organization

```typescript
// 1. External imports
import { useState, useEffect } from 'react';

// 2. Internal imports
import { User, AgentRequest } from '@/types';
import { apiClient } from '@/lib/api-client';

// 3. Type definitions
interface ComponentProps {
  user: User;
  onSubmit: (req: AgentRequest) => void;
}

// 4. Implementation
export const AgentComponent = ({ user, onSubmit }: ComponentProps) => {
  // ...
};
```

### Type Conflicts

Alias imported types that collide with built-ins.

```typescript
// ✅ CORRECT
import { Record as ApiRecord } from '@/types/api';

// ❌ WRONG — shadows the TS built-in Record<K, V>
import { Record } from '@/types/api';
```

---

## Code Quality

### Linting and Formatting

- **ESLint**: `npm run lint` in `frontend/` must pass before a change is done.
- **Line length**: aim for ≤ 100 characters.
- **Indentation**: 2 spaces.
- **Semicolons**: always.
- **Quotes**: single quotes in TS, double quotes in JSX attributes.

### Component Export Pattern

```typescript
// ✅ CORRECT — named export, const arrow component
export const MyComponent = () => { /* ... */ };

// ❌ WRONG — default export
export default function MyComponent() { /* ... */ }
```

(Next.js `page.tsx` / `layout.tsx` files are the deliberate exception: the App
Router requires default exports there.)

### API Access Pattern

**RULE**: Route all backend calls through a single typed client
(`src/lib/api-client.ts`), not scattered `fetch` calls. Centralizing makes the
base URL, headers, error handling, and typing consistent. See
`backend-integration.md`.

### Error Handling

- Handle the non-happy path explicitly: network failure, non-2xx responses,
  and malformed payloads.
- Surface user-facing errors through UI state, not silent `console.log`.

---

## Documentation Rules

### When to Create Documentation

**DO** create documentation when:
- The user explicitly requests it.
- Writing specs, requirements, or steering files.
- Documenting an architectural decision or an integration contract.

**DON'T** create documentation for:
- Completing simple tasks or small code changes.
- Bug fixes or refactors.
- Summarizing work (unless explicitly requested).

### CRITICAL RULES

- ❌ **NEVER create summary files** (`SUMMARY.md`, `NOTES.md`, `CHANGES.md`).
- ❌ **NEVER create markdown files** just to narrate your work process.
- ✅ **Only create docs** when explicitly requested.
- ✅ **Update existing specs/steering** files instead of adding parallel ones.

---

## Security

### Data Minimization

Only send the fields the UI actually needs across the API boundary. Don't leak
internal backend identifiers or audit fields to the browser if nothing renders
them.

### Secrets

- Use `.env.local` / untracked `.env`; never hardcode credentials.
- Keep secret-bearing files in `.gitignore`.
- Don't log tokens or credentials.

### Temporary Files

- `.kiro/temp/` may hold sensitive output — clean it up and keep it ignored.

---

**Document Version**: 1.0
**Last Updated**: 2026-11-07
**Status**: Active
