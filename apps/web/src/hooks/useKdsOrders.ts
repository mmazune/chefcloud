/**
 * M28-KDS-S1: KDS Orders Hook
 * M28-KDS-S2: Extended with auto-refresh and lastUpdatedAt
 * M28-KDS-S3: Extended with setExternalOrders for WebSocket integration
 * 
 * Cache-first data loading for Kitchen Display System.
 * - Immediately shows cached tickets if available
 * - Fetches fresh data from network in parallel
 * - Updates cache on successful network fetch
 * - Tracks cache age and staleness (24h TTL by default)
 * - Optional auto-refresh polling (online-only)
 * - External updates via WebSocket (setExternalOrders)
 */

import { useEffect, useState, useCallback } from 'react';
import { loadPosSnapshot, savePosSnapshot, isSnapshotStale, getSnapshotAgeMs } from '@/lib/posIndexedDb';
import type { KdsOrder, KdsOrderListResponse } from '@/types/pos';

type Source = 'none' | 'cache' | 'network';

interface UseKdsOrdersOptions {
  autoRefreshIntervalMs?: number;
}

interface UseKdsOrdersResult {
  orders: KdsOrder[];
  isLoading: boolean;
  error: Error | null;
  source: Source;
  isStale: boolean;
  ageMs: number | null;
  reload: () => void;
  lastUpdatedAt: string | null;
  setExternalOrders: (next: KdsOrder[]) => void;
}

const SNAPSHOT_KEY = 'kdsOrders';

export function useKdsOrders(options: UseKdsOrdersOptions = {}): UseKdsOrdersResult {
  const { autoRefreshIntervalMs } = options;
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [isStaleState, setIsStaleState] = useState<boolean>(false);
  const [ageMs, setAgeMs] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // M28-KDS-S3: External setter for WebSocket push updates
  const setExternalOrders = useCallback((next: KdsOrder[]) => {
    setOrders(next);
    setSource('network');
    setError(null);
    const nowIso = new Date().toISOString();
    setLastUpdatedAt(nowIso);
    setIsStaleState(false);
    setAgeMs(0);
    void savePosSnapshot<KdsOrder[]>(SNAPSHOT_KEY as any, next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const snapshot = await loadPosSnapshot<KdsOrder[]>(SNAPSHOT_KEY as any);
      if (cancelled) return;
      if (snapshot) {
        setOrders(snapshot.data);
        setSource(prev => (prev === 'network' ? prev : 'cache'));
        const stale = isSnapshotStale(snapshot.updatedAt);
        setIsStaleState(stale);
        setAgeMs(getSnapshotAgeMs(snapshot.updatedAt));
        setLastUpdatedAt(snapshot.updatedAt ?? null);
      }
    }

    async function loadNetwork() {
      if (typeof window === 'undefined') return;
      if (!navigator.onLine) return;

      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/kds/orders`, {
          headers: {
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!resp.ok) {
          throw new Error(`Failed to load KDS orders: ${resp.status}`);
        }

        const payload = (await resp.json()) as KdsOrderListResponse;
        if (cancelled) return;

        const nowIso = new Date().toISOString();
        setOrders(payload.orders ?? []);
        setSource('network');
        setError(null);
        setLastUpdatedAt(nowIso);

        void savePosSnapshot<KdsOrder[]>(SNAPSHOT_KEY as any, payload.orders ?? []);

        setIsStaleState(false);
        setAgeMs(0);
      } catch (err: any) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load KDS orders'));
      }
    }

    setIsLoading(true);

    void loadCache().then(() => {
      void loadNetwork().finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Auto-refresh polling effect (online-only)
  useEffect(() => {
    if (!autoRefreshIntervalMs) return;
    if (typeof window === 'undefined') return;

    function schedule() {
      // Only auto-refresh while online
      if (navigator.onLine) {
        setReloadToken(token => token + 1);
      }
    }

    const intervalId = window.setInterval(schedule, autoRefreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshIntervalMs]);

  const reload = () => setReloadToken(token => token + 1);

  return { orders, isLoading, error, source, isStale: isStaleState, ageMs, reload, lastUpdatedAt, setExternalOrders };
}
