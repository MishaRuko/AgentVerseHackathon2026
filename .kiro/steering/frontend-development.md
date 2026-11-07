# Frontend Development Guide

**Last Modified**: 2026-11-07
**Status**: Active - Complete frontend development reference

---

## Table of Contents

1. [Architecture](#architecture)
2. [Directory Structure](#directory-structure)
3. [Component Patterns](#component-patterns)
4. [Custom Hooks](#custom-hooks)
5. [Data Fetching](#data-fetching)
6. [Styling (Tailwind v4)](#styling-tailwind-v4)
7. [Accessibility](#accessibility)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Best Practices](#best-practices)

---

## Architecture

**Core Framework**:
- Next.js 16 — App Router with React Server Components
- React 19
- TypeScript (strict)
- Tailwind CSS v4 (CSS-first config via `@import "tailwindcss"`)
- ESLint (`eslint-config-next`)

**Conventions**:
- Server Components by default. Add `'use client'` only when a component needs
  state, effects, refs, or browser APIs.
- Keep components small and composable; lift data fetching to the server where
  possible.
- Talk to the backend only through the typed API client (see
  `backend-integration.md`). Do not scatter raw `fetch` calls through components.

---

## Directory Structure

```
frontend/src/
├── app/            # App Router routes, layouts, pages
├── components/     # Reusable React components
├── hooks/          # Custom React hooks
├── lib/            # API client, shared utilities
├── types/          # Shared TypeScript types (incl. API shapes)
└── styles/         # Global styles if needed beyond app/globals.css
```

Create these folders as the app grows — they don't all need to exist on day one.

---

## Component Patterns

### Component Template

```typescript
import { ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Short description of the component and when to use it.
 */
export const Panel = ({ title, children, className = '' }: Props) => {
  return (
    <section className={`rounded-lg border p-4 ${className}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
};
```

### Client vs Server

```typescript
// Server Component (default) — no 'use client'. Can be async, can fetch.
export const AgentList = async () => {
  const agents = await apiClient.listAgents();
  return <ul>{agents.map((a) => <li key={a.id}>{a.name}</li>)}</ul>;
};

// Client Component — needs interactivity.
'use client';
import { useState } from 'react';

export const Counter = () => {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
};
```

---

## Custom Hooks

```typescript
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Agent } from '@/types';

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAgents(): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await apiClient.listAgents());
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { agents, loading, error, refresh };
}
```

---

## Data Fetching

- Prefer fetching in **Server Components** or Route Handlers where possible —
  secrets stay on the server and the client ships less JS.
- For client-side fetching, go through the typed client and a hook like the one
  above; handle `loading` and `error` states explicitly.
- Validate/narrow external responses at the boundary. Don't assume the backend
  payload matches your type — type it and guard it.

---

## Styling (Tailwind v4)

Tailwind v4 uses a CSS-first setup. The global stylesheet imports Tailwind
directly:

```css
/* src/app/globals.css */
@import "tailwindcss";
```

- Customize the theme with `@theme` in CSS rather than a large JS config.
- Use utility classes in markup; extract a component when a class list repeats.
- Mobile-first: base styles target small screens, add `sm: md: lg:` upward.

---

## Accessibility

- Use semantic HTML (`button`, `nav`, `main`, `label`), not clickable `div`s.
- Label every form control (`<label htmlFor>`), associate help text via
  `aria-describedby`.
- Dialogs: `role="dialog"`, `aria-modal`, focus trap, Escape to close, restore
  focus on close.
- Full WCAG conformance needs manual testing with assistive tech and expert
  review — treat these rules as a baseline, not a guarantee.

---

## Error Handling

- Use an App Router `error.tsx` boundary per route segment for render errors.
- Show loading skeletons via `loading.tsx` or explicit `loading` state.
- For data errors, render an error state with a retry affordance rather than
  failing silently.

---

## Testing

No test framework is wired up yet. When tests are first needed, the standard
choice for this stack is **Vitest + React Testing Library** (fast, ESM-native,
good Next.js fit). Add it then rather than pre-emptively.

- Run tests once (not watch) in CI / verification: `vitest run`.
- Name tests `should [behavior] when [condition]`.
- Favor testing behavior through the rendered component over implementation
  details.

---

## Best Practices

### Do ✅
- Named exports with `const` arrow components.
- Precise TypeScript types for props and API data.
- Server Components by default; `'use client'` only when needed.
- Centralize backend calls in the typed API client.
- Explicit loading and error states.
- Semantic, accessible markup.

### Don't ❌
- Default exports (except App Router `page`/`layout`/`error`/`loading`).
- Raw `fetch` scattered through components.
- `any` types or unchecked external data.
- Swallowing errors with a bare `console.log`.
- Premature optimization or abstraction.

---

**Document Version**: 1.0
**Last Updated**: 2026-11-07
**Status**: Active
