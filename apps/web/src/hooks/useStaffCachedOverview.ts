/**
 * M27-S5: Offline-first Staff Overview Hook
 * 
 * Provides cached staff data with same pattern as POS:
 * - Cache-first strategy (instant load from IndexedDB)
 * - Network update when online (fresh data)
 * - Staleness detection via shared TTL logic
 * - Works offline after at least one online visit
 */

import { useEffect, useState } from 'react';
import {
  loadPosSnapshot,
  savePosSnapshot,
  isSnapshotStale,
  getSnapshotAgeMs,
} from '@/lib/posIndexedDb';

// Replace with a real type if you have one
export type StaffOverviewData = any;

type Source = 'none' | 'cache' | 'network';

interface UseStaffCachedOverviewResult {
  staffOverview: StaffOverviewData | null;
  isLoading: boolean;
  error: Error | null;
  source: Source;
  isStale: boolean;
  ageMs: number | null;
}

/**
 * Offline-first staff overview:
 * - Uses IndexedDB snapshot key "staffOverview"
 * - Cache first (instant) -> network update (fresh) when online
 */
export function useStaffCachedOverview(): UseStaffCachedOverviewResult {
  const [staffOverview, setStaffOverview] = useState<StaffOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [isStaleState, setIsStaleState] = useState<boolean>(false);
  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const snapshot = await loadPosSnapshot<StaffOverviewData>('staffOverview');
      if (cancelled) return;
      if (snapshot) {
        setStaffOverview(snapshot.data);
        setSource(prev => (prev === 'network' ? prev : 'cache'));
        const stale = isSnapshotStale(snapshot.updatedAt);
        setIsStaleState(stale);
        setAgeMs(getSnapshotAgeMs(snapshot.updatedAt));
      }
    }

    async function loadNetwork() {
      if (typeof window === 'undefined') return;
      if (!navigator.onLine) return;

      try {
        // NOTE: adjust this endpoint to your real staff overview API
        const resp = await fetch('/api/hr/staff', {
          headers: { Accept: 'application/json' },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load staff overview: ${resp.status}`);
        }

        const data = (await resp.json()) as StaffOverviewData;
        if (cancelled) return;

        setStaffOverview(data);
        setSource('network');
        setError(null);

        void savePosSnapshot<StaffOverviewData>('staffOverview', data);

        setIsStaleState(false);
        setAgeMs(0);
      } catch (err: any) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load staff overview'));
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

  return { staffOverview, isLoading, error, source, isStale: isStaleState, ageMs };
}
