/**
 * M27-S3: Cached POS Open Orders Hook
 * M27-S6: Extended with staleness detection and cache age tracking
 * 
 * Provides offline-first open orders data with IndexedDB caching.
 * - Immediately shows cached data if available
 * - Fetches fresh data from network in parallel
 * - Updates cache on successful network fetch
 * - Tracks cache age and staleness (24h TTL by default)
 */

import { useEffect, useState } from 'react';
import { loadPosSnapshot, savePosSnapshot, isSnapshotStale, getSnapshotAgeMs } from '@/lib/posIndexedDb';

export interface PosOrder {
  id: string;
  tableName: string | null;
  tabName: string | null;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
}

export type PosOpenOrdersData = PosOrder[];

type Source = 'none' | 'cache' | 'network';

interface UsePosCachedOpenOrdersResult {
  openOrders: PosOpenOrdersData | null;
  isLoading: boolean;
  error: Error | null;
  source: Source;
  isStale: boolean;
  ageMs: number | null;
}

export function usePosCachedOpenOrders(): UsePosCachedOpenOrdersResult {
  const [openOrders, setOpenOrders] = useState<PosOpenOrdersData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [isStale, setIsStale] = useState<boolean>(false);
  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const snapshot = await loadPosSnapshot<PosOpenOrdersData>('openOrders');
      if (cancelled) return;
      if (snapshot) {
        setOpenOrders(snapshot.data);
        setSource(prev => (prev === 'network' ? prev : 'cache'));
        const stale = isSnapshotStale(snapshot.updatedAt);
        setIsStale(stale);
        setAgeMs(getSnapshotAgeMs(snapshot.updatedAt));
      }
    }

    async function loadNetwork() {
      if (typeof window === 'undefined') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/pos/orders?status=OPEN`, {
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include',
        });

        if (!resp.ok) {
          throw new Error(`Failed to load POS open orders: ${resp.status}`);
        }

        const data = (await resp.json()) as PosOpenOrdersData;
        if (cancelled) return;

        setOpenOrders(data);
        setSource('network');
        setError(null);

        void savePosSnapshot<PosOpenOrdersData>('openOrders', data);

        setIsStale(false);
        setAgeMs(0);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load POS open orders'));
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
  }, []);

  return { openOrders, isLoading, error, source, isStale, ageMs };
}
