// apps/web/src/components/common/AppErrorBoundary.tsx
'use client';

import React from 'react';

export type ErrorBoundaryContext = 'POS' | 'KDS' | 'APP';

export interface AppErrorBoundaryProps {
  context?: ErrorBoundaryContext;
  children: React.ReactNode;
}

export interface LastErrorRecord {
  context: ErrorBoundaryContext;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  timestampIso: string;
}

const LAST_ERROR_STORAGE_KEY = 'chefcloud_last_error_v1';

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Best-effort logging
    // eslint-disable-next-line no-console
    console.error('AppErrorBoundary caught error', error, info);

    const context: ErrorBoundaryContext = this.props.context ?? 'APP';

    const record: LastErrorRecord = {
      context,
      message: error?.message ?? 'Unknown error',
      stack: error?.stack ?? null,
      componentStack: info?.componentStack ?? null,
      timestampIso: new Date().toISOString(),
    };

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        window.localStorage.setItem(
          LAST_ERROR_STORAGE_KEY,
          JSON.stringify(record),
        );
      } catch {
        // ignore storage errors
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-xs text-slate-400">
            The ChefCloud app hit an unexpected error. You can try reloading
            the app. If this keeps happening, open the Diagnostics panel and
            share a snapshot with support.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-emerald-400"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = '/pos')}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
            >
              Go to POS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Small helpers reused by hook & tests
export function readLastErrorRecord(): LastErrorRecord | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LAST_ERROR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastErrorRecord;
    if (!parsed || !parsed.message) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastErrorRecord(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(LAST_ERROR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
