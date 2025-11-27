/**
 * M27-S3: Cached POS Menu Hook
 * M27-S6: Extended with staleness detection and cache age tracking
 * 
 * Provides offline-first menu data with IndexedDB caching.
 * - Immediately shows cached data if available
 * - Fetches fresh data from network in parallel
 * - Updates cache on successful network fetch
 * - Tracks cache age and staleness (24h TTL by default)
 */

import { useEffect, useState } from 'react';
import { loadPosSnapshot, savePosSnapshot, isSnapshotStale, getSnapshotAgeMs } from '@/lib/posIndexedDb';

export interface PosMenuItem {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  category?: {
    name: string;
  } | null;
  isActive?: boolean;
}

export type PosMenuData = PosMenuItem[];

type Source = 'none' | 'cache' | 'network';

interface UsePosCachedMenuResult {
  menu: PosMenuData | null;
  isLoading: boolean;
  error: Error | null;
  source: Source;
  isStale: boolean;
  ageMs: number | null;
}

export function usePosCachedMenu(): UsePosCachedMenuResult {
  const [menu, setMenu] = useState<PosMenuData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [isStale, setIsStale] = useState<boolean>(false);
  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const snapshot = await loadPosSnapshot<PosMenuData>('menu');
      if (cancelled) return;
      if (snapshot) {
        setMenu(snapshot.data);
        setSource(prev => (prev === 'network' ? prev : 'cache'));
        const stale = isSnapshotStale(snapshot.updatedAt);
        setIsStale(stale);
        setAgeMs(getSnapshotAgeMs(snapshot.updatedAt));
      }
    }

    async function loadNetwork() {
      if (typeof window === 'undefined') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Offline – rely on cache if present
        return;
      }

      try {
        const resp = await fetch('/api/menu/items', {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load POS menu: ${resp.status}`);
        }

        const data = (await resp.json()) as PosMenuData;
        if (cancelled) return;

        setMenu(data);
        setSource('network');
        setError(null);

        // Persist snapshot for future offline use
        void savePosSnapshot<PosMenuData>('menu', data);

        setIsStale(false);
        setAgeMs(0);
      } catch (err: unknown) {
        if (cancelled) return;
        // If cache exists, we keep showing it; only mark error if no cache
        setError(err instanceof Error ? err : new Error('Failed to load POS menu'));
      }
    }

    setIsLoading(true);
    void loadCache().then(() => {
      // Whether or not cache was found, attempt network if online
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

  return { menu, isLoading, error, source, isStale, ageMs };
}
