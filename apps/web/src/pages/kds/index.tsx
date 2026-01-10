/**
 * M28-KDS-S1: Kitchen Display System Page
 * M28-KDS-S2: Extended with live updates, filters, and priority
 * M28-KDS-S3: Extended with WebSocket real-time updates
 * M28-KDS-S4: Extended with local preferences (thresholds, filters, behavior)
 * M28-KDS-S5: Extended with audio alerts for new and late tickets
 * 
 * Production-ready KDS web screen for kitchen staff.
 * Optimized for:
 * - Landscape tablets / wall-mounted screens
 * - Touch-friendly buttons
 * - Real-time WebSocket updates (with 10s polling fallback)
 * - Status filters (All / New / In Progress / Ready)
 * - Per-device settings (priority thresholds, display options, sound alerts)
 * - Audio alerts (new ticket, late ticket) with per-device preferences
 * - Offline-first (read cache when offline, online-only writes)
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useKdsOrders } from '@/hooks/useKdsOrders';
import { useKdsSocket } from '@/hooks/useKdsSocket';
import { useKdsPreferences } from '@/hooks/useKdsPreferences';
import { useKdsSoundAlerts } from '@/hooks/useKdsSoundAlerts';
import { KdsOrderCard } from '@/components/kds/KdsOrderCard';
import { KdsSettingsDrawer } from '@/components/kds/KdsSettingsDrawer';
import { KioskToggleButton } from '@/components/common/KioskToggleButton';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I2: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/kds',
  title: 'Kitchen Display System',
  primaryActions: [
    { label: 'Mark In Progress', testId: 'kds-in-progress', intent: 'update' },
    { label: 'Mark Ready', testId: 'kds-ready', intent: 'update' },
    { label: 'Recall Order', testId: 'kds-recall', intent: 'update' },
    { label: 'Filter Status', testId: 'kds-filter', intent: 'view' },
    { label: 'Settings', testId: 'kds-settings', intent: 'view' },
  ],
  apiCalls: [
    { method: 'GET', path: '/kds/tickets', trigger: 'onMount', notes: 'Fetch tickets' },
    { method: 'PATCH', path: '/kds/tickets/:id/start', trigger: 'onAction', notes: 'Start prep' },
    { method: 'PATCH', path: '/kds/tickets/:id/ready', trigger: 'onAction', notes: 'Mark ready' },
    { method: 'PATCH', path: '/kds/tickets/:id/recall', trigger: 'onAction', notes: 'Recall' },
  ],
  risk: 'LOW',
  allowedRoles: ['OWNER', 'MANAGER', 'SUPERVISOR', 'CHEF'],
});
import { DEVICE_ROLE_LABELS } from '@/types/deviceRole';
import { useAppUpdateBanner } from '@/hooks/useAppUpdateBanner';
import { APP_VERSION } from '@/version';
import Link from 'next/link';
import { kdsAction } from '@/lib/kdsApi';
import { SystemDiagnosticsPanel } from '@/components/common/SystemDiagnosticsPanel';
import { DiagnosticsToggleButton } from '@/components/common/DiagnosticsToggleButton';

type KdsFilter = 'ALL' | 'NEW' | 'IN_PROGRESS' | 'READY';

export default function KdsPage() {
  const isOnline = useOnlineStatus();
  const [filter, setFilter] = useState<KdsFilter>('ALL');
  const [_isActioning, setIsActioning] = useState<string | null>(null);

  // M29-PWA-S2: Device role for multi-device deployment
  const { role } = useDeviceRole();

  // M29-PWA-S3: App update detection
  const { hasUpdate, reloadWithUpdate } = useAppUpdateBanner();

  // M28-KDS-S3: WebSocket connection status
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // M28-KDS-S4: Settings drawer and preferences
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { prefs } = useKdsPreferences();

  // M30-OPS-S1: Diagnostics panel state
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Main data hook with polling fallback
  const { orders, isLoading, error, source, isStale, reload, lastUpdatedAt, setExternalOrders } = useKdsOrders({
    // Disable polling when WebSocket is connected
    autoRefreshIntervalMs: isRealtimeConnected ? undefined : 10_000,
  });

  // WebSocket hook - receives real-time updates
  const { isConnected: socketConnected } = useKdsSocket({
    onOrdersUpdated: (nextOrders) => {
      setExternalOrders(nextOrders);
    },
  });

  // Track WebSocket connection status
  useEffect(() => {
    setIsRealtimeConnected(socketConnected);
  }, [socketConnected]);

  // M28-KDS-S5: Sound alerts for new and late tickets
  useKdsSoundAlerts({
    orders,
    prefs,
    isOnline,
  });

  // M28-KDS-S4: Apply hideServed preference before status filter
  const effectiveOrders = useMemo(() => {
    let list = orders;
    if (prefs.display.hideServed) {
      list = list.filter(o => o.status !== 'SERVED');
    }
    return list;
  }, [orders, prefs.display.hideServed]);

  const filteredOrders = useMemo(() => {
    switch (filter) {
      case 'NEW':
        return effectiveOrders.filter(o => o.status === 'NEW');
      case 'IN_PROGRESS':
        return effectiveOrders.filter(o => o.status === 'IN_PROGRESS');
      case 'READY':
        return effectiveOrders.filter(o => o.status === 'READY');
      case 'ALL':
      default:
        return effectiveOrders;
    }
  }, [effectiveOrders, filter]);

  const handleAction = async (orderId: string, type: Parameters<typeof kdsAction>[0]) => {
    if (!isOnline) {
      // For this slice, we do not queue KDS writes
      alert('You are offline. KDS actions require a live connection.');
      return;
    }

    setIsActioning(orderId);
    try {
      await kdsAction(type, { orderId });
      reload();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'KDS action failed');
    } finally {
      setIsActioning(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* M29-PWA-S3: App update banner */}
      {hasUpdate && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-100">
          <div>
            <span className="font-medium">New ChefCloud version ready.</span>{' '}
            <span className="text-emerald-200/80">
              Current: {APP_VERSION}. Reload between services if safe.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void reloadWithUpdate()}
            className="rounded-md bg-emerald-400 px-3 py-1 text-[10px] font-semibold text-slate-900 hover:bg-emerald-300"
          >
            Reload
          </button>
        </div>
      )}

      {/* Top status bar */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">ChefCloud KDS</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
              isOnline
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                : 'border-red-400 bg-red-500/10 text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {isOnline ? 'Online' : 'Offline – read-only'}
          </span>
          {source !== 'none' && (
            <span className="text-[10px] text-slate-400">
              Source: {source}{' '}
              {isStale && <span className="text-amber-300 ml-1">(stale snapshot)</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* M28-KDS-S3: Real-time connection status */}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
              isRealtimeConnected
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-500 bg-slate-800 text-slate-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isRealtimeConnected ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            {isRealtimeConnected ? 'Realtime: connected' : 'Realtime: fallback'}
          </span>

          {lastUpdatedAt && (
            <span className="text-[10px] text-slate-400">
              Last updated:{' '}
              {new Date(lastUpdatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          <div className="inline-flex gap-1 rounded-full bg-slate-900/60 p-1">
            {(['ALL', 'NEW', 'IN_PROGRESS', 'READY'] as KdsFilter[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  filter === v
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {v === 'ALL' ? 'All' : v.replace('_', ' ').toLowerCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-full border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:bg-slate-800"
            aria-label="KDS settings"
          >
            <span className="text-[13px]">⚙︎</span>
          </button>

          <Link
            href="/launch"
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 border border-slate-700 rounded-full px-2 py-0.5 bg-slate-900/60"
          >
            Device: {DEVICE_ROLE_LABELS[role]}
          </Link>

          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-700"
          >
            Refresh
          </button>

          <DiagnosticsToggleButton onClick={() => setDiagnosticsOpen(true)} />

          <KioskToggleButton size="sm" />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/60 border-b border-red-500 px-4 py-2 text-[11px] text-red-100">
          {error.message}
        </div>
      )}

      {/* Main board */}
      <main id="main-content" role="main" className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && orders.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Loading tickets…
          </div>
        )}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            {orders.length === 0 ? 'No active kitchen tickets.' : 'No tickets for this filter.'}
          </div>
        )}

        {filteredOrders.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredOrders.map(order => (
              <KdsOrderCard
                key={order.id}
                order={order}
                onStart={() => handleAction(order.id, 'start')}
                onReady={() => handleAction(order.id, 'markReady')}
                onRecall={() => handleAction(order.id, 'recall')}
                onServed={() => handleAction(order.id, 'markServed')}
                dueSoonMinutes={prefs.priority.dueSoonMinutes}
                lateMinutes={prefs.priority.lateMinutes}
                dimReadyAfterMinutes={prefs.display.dimReadyAfterMinutes}
              />
            ))}
          </div>
        )}
      </main>

      {/* M28-KDS-S4: Settings drawer */}
      <KdsSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* M30-OPS-S1: System Diagnostics Panel */}
      <SystemDiagnosticsPanel
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        context="KDS"
      />
    </div>
  );
}
