// apps/web/src/components/common/SystemDiagnosticsPanel.tsx
'use client';

import React from 'react';
import { APP_VERSION } from '@/version';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useOfflineStorageEstimate } from '@/hooks/useOfflineStorageEstimate';
import { usePosCachedMenu } from '@/hooks/usePosCachedMenu';
import { usePosCachedOpenOrders } from '@/hooks/usePosCachedOpenOrders';
import { useKioskMode } from '@/hooks/useKioskMode';
import { useLastErrorRecord } from '@/hooks/useLastErrorRecord';
import { formatAgeMs, formatBytes, type DiagnosticsSnapshot, serializeDiagnosticsSnapshot } from '@/lib/diagnostics';

export interface SystemDiagnosticsPanelProps {
  open: boolean;
  onClose: () => void;
  context: 'POS' | 'KDS';
}

export function SystemDiagnosticsPanel(props: SystemDiagnosticsPanelProps) {
  const { open, onClose, context } = props;
  const { role, isLoaded: isRoleLoaded } = useDeviceRole();
  const isOnline = useOnlineStatus();
  const {
    queue,
    syncLog,
  } = useOfflineQueue();
  const { usage, quota } = useOfflineStorageEstimate();
  const { menu: menuItems, isStale: isMenuStale, ageMs: menuAgeMs } =
    usePosCachedMenu();
  const { openOrders, isStale: isOrdersStale, ageMs: ordersAgeMs } =
    usePosCachedOpenOrders();
  const kiosk = useKioskMode();
  const { lastError, clear: clearLastError } = useLastErrorRecord();

  const [copied, setCopied] = React.useState(false);

  // Compute derived values
  const queuedCount = queue?.length ?? 0;
  const failedCount =
    syncLog?.filter(entry => entry.status === 'failed').length ?? 0;
  const conflictCount =
    syncLog?.filter(entry => entry.status === 'conflict').length ?? 0;

  const now = new Date();

  const snapshot: DiagnosticsSnapshot = React.useMemo(() => ({
    appVersion: APP_VERSION,
    context,

    timestampIso: new Date().toISOString(),

    deviceRole: isRoleLoaded ? String(role) : 'unknown',
    online: !!isOnline,
    kiosk: {
      supported: !!kiosk.isSupported,
      active: !!kiosk.isActive,
    },

    offlineQueue: {
      queuedCount,
      failedCount,
      conflictCount,
      historyCount: syncLog?.length ?? 0,
    },

    cache: {
      menuItemsCount: menuItems?.length ?? 0,
      menuStale: !!isMenuStale,
      menuAgeMs: menuAgeMs ?? null,
      openOrdersCount: openOrders?.length ?? 0,
      openOrdersStale: !!isOrdersStale,
      openOrdersAgeMs: ordersAgeMs ?? null,
    },

    storage: {
      usageBytes: usage ?? null,
      quotaBytes: quota ?? null,
    },

    environment: {
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
      platform:
        typeof navigator !== 'undefined' ? navigator.platform : null,
      serviceWorkerSupported:
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator,
      language:
        typeof navigator !== 'undefined' ? navigator.language : null,
      locationHref:
        typeof window !== 'undefined' ? window.location.href : null,
      screen: {
        width:
          typeof window !== 'undefined' ? window.innerWidth : null,
        height:
          typeof window !== 'undefined' ? window.innerHeight : null,
      },
      nodeEnv: typeof process !== 'undefined' ? process.env.NODE_ENV ?? null : null,
      apiBaseUrl:
        typeof process !== 'undefined'
          ? process.env.NEXT_PUBLIC_API_BASE_URL ?? null
          : null,
    },

    lastError: {
      hasError: !!lastError,
      context: lastError?.context ?? null,
      message: lastError?.message ?? null,
      timestampIso: lastError?.timestampIso ?? null,
    },
  }), [
    context,
    isRoleLoaded,
    role,
    isOnline,
    kiosk.isSupported,
    kiosk.isActive,
    queuedCount,
    failedCount,
    conflictCount,
    syncLog?.length,
    menuItems?.length,
    isMenuStale,
    menuAgeMs,
    openOrders?.length,
    isOrdersStale,
    ordersAgeMs,
    usage,
    quota,
    lastError,
  ]);

  const handleCopyJson = React.useCallback(async () => {
    const payload = serializeDiagnosticsSnapshot(snapshot);
    try {
      if (navigator && 'clipboard' in navigator && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(payload);
      } else {
        // Fallback: create a temporary textarea (best effort)
        const el = document.createElement('textarea');
        el.value = payload;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore copy errors; no user-facing error for now
    }
  }, [snapshot]);

  const handleDownloadJson = React.useCallback(() => {
    try {
      const payload = serializeDiagnosticsSnapshot(snapshot);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = snapshot.timestampIso.replace(/[:.]/g, '-');
      a.href = url;
      a.download = `chefcloud-${snapshot.context.toLowerCase()}-diagnostics-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore download errors
    }
  }, [snapshot]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-100 shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <h2 className="text-sm font-semibold">
              {context === 'POS' ? 'POS diagnostics' : 'KDS diagnostics'}
            </h2>
            <p className="text-[11px] text-slate-400">
              For support / ops only. Safe to show to remote engineers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800"
          >
            Close
          </button>
        </header>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {/* App & device */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <h3 className="text-[11px] font-semibold text-slate-200">
              App & device
            </h3>
            <dl className="mt-1 space-y-1 text-[11px] text-slate-300">
              <Row label="App version" value={APP_VERSION} />
              <Row
                label="Context"
                value={context}
              />
              <Row
                label="Device role"
                value={isRoleLoaded ? role : 'Loading…'}
              />
              <Row
                label="Online status"
                value={isOnline ? 'Online' : 'Offline'}
              />
              <Row
                label="Kiosk"
                value={
                  kiosk.isSupported
                    ? kiosk.isActive
                      ? 'Active'
                      : 'Available'
                    : 'Not supported'
                }
              />
              <Row
                label="Time (local)"
                value={now.toLocaleString()}
              />
            </dl>
          </section>

          {/* Offline queue & sync */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <h3 className="text-[11px] font-semibold text-slate-200">
              Offline queue & sync
            </h3>
            <dl className="mt-1 space-y-1 text-[11px] text-slate-300">
              <Row label="Queued actions" value={String(queuedCount)} />
              <Row label="Failed actions" value={String(failedCount)} />
              <Row label="Conflicts" value={String(conflictCount)} />
              <Row
                label="Has history"
                value={syncLog && syncLog.length > 0 ? 'Yes' : 'No'}
              />
            </dl>
          </section>

          {/* Cache & storage */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <h3 className="text-[11px] font-semibold text-slate-200">
              Cache & storage
            </h3>
            <dl className="mt-1 space-y-1 text-[11px] text-slate-300">
              <Row
                label="Menu items cached"
                value={String(menuItems?.length ?? 0)}
                hint={
                  isMenuStale
                    ? `Stale (${formatAgeMs(menuAgeMs)})`
                    : menuAgeMs
                    ? `Fresh (${formatAgeMs(menuAgeMs)})`
                    : 'No age data'
                }
              />
              <Row
                label="Open orders cached"
                value={String(openOrders?.length ?? 0)}
                hint={
                  isOrdersStale
                    ? `Stale (${formatAgeMs(ordersAgeMs)})`
                    : ordersAgeMs
                    ? `Fresh (${formatAgeMs(ordersAgeMs)})`
                    : 'No age data'
                }
              />
              <Row
                label="Storage usage"
                value={usage != null ? formatBytes(usage) : 'Unknown'}
                hint={
                  quota != null
                    ? `Quota: ${formatBytes(quota)}`
                    : 'Quota unknown'
                }
              />
            </dl>
          </section>

          {/* Environment */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <h3 className="text-[11px] font-semibold text-slate-200">
              Environment
            </h3>
            <dl className="mt-1 space-y-1 text-[11px] text-slate-300">
              <Row
                label="User agent"
                value={
                  typeof navigator !== 'undefined'
                    ? navigator.userAgent
                    : 'N/A'
                }
              />
              <Row
                label="Platform"
                value={
                  typeof navigator !== 'undefined'
                    ? navigator.platform
                    : 'N/A'
                }
              />
              <Row
                label="Service worker"
                value={
                  typeof navigator !== 'undefined' &&
                  'serviceWorker' in navigator
                    ? 'Supported'
                    : 'Not supported'
                }
              />
              <Row
                label="Last error"
                value={
                  lastError
                    ? `${lastError.context} @ ${lastError.timestampIso}`
                    : 'None'
                }
                hint={
                  lastError
                    ? (lastError.message.length > 80
                        ? `${lastError.message.slice(0, 77)}…`
                        : lastError.message)
                    : 'No recent crash recorded'
                }
              />
            </dl>
            {lastError && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearLastError}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                >
                  Clear last error
                </button>
              </div>
            )}
          </section>

          {/* Support tools */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 md:col-span-2">
            <h3 className="text-[11px] font-semibold text-slate-200">
              Support tools
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Use these actions when talking to support or engineers. It is safe to share the exported JSON.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleCopyJson}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                Copy JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-200"
              >
                Download JSON
              </button>
              {copied && (
                <span className="text-[10px] text-emerald-400">
                  Copied to clipboard
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  hint?: string;
}

function Row({ label, value, hint }: RowProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-[11px] text-slate-100 truncate">
          {value}
        </span>
      </div>
      {hint && (
        <span className="text-[10px] text-slate-500 mt-0.5">{hint}</span>
      )}
    </div>
  );
}
