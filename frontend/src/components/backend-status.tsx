'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Status = 'checking' | 'online' | 'offline';

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  checking: { label: 'Checking…', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  online: { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  offline: { label: 'Offline', dot: 'bg-zinc-400', text: 'text-zinc-500' },
};

export const BackendStatus = () => {
  const [status, setStatus] = useState<Status>('checking');

  const runHealthCheck = useCallback(async () => {
    try {
      const res = await apiClient.health();
      setStatus(res.status === 'ok' ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  const retry = useCallback(() => {
    setStatus('checking');
    void runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    // Fetching from the backend on mount is a valid effect; setState happens
    // only after the async health check resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runHealthCheck();
  }, [runHealthCheck]);

  const meta = STATUS_META[status];

  return (
    <div
      id="status"
      className="flex scroll-mt-20 flex-col items-start justify-between gap-4 rounded-2xl border border-black/[.08] bg-white p-6 sm:flex-row sm:items-center dark:border-white/[.12] dark:bg-zinc-950"
    >
      <div>
        <h3 className="font-semibold tracking-tight text-black dark:text-white">Backend connection</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pinging <code className="font-mono text-[0.9em]">{apiClient.baseUrl}/health</code>. Expected
          offline until the Dockerized backend is running.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-2 text-sm font-medium ${meta.text}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <button
          type="button"
          onClick={retry}
          className="rounded-full border border-black/[.1] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          Retry
        </button>
      </div>
    </div>
  );
};
