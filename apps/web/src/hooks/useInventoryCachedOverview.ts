/**
 * M27-S5: Offline-first Inventory Overview Hook
 * 
 * Provides cached inventory data with same pattern as POS:
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

// Replace this with your real type from contracts if available
export type InventoryOverviewData = any;

type Source = 'none' | 'cache' | 'network';

interface UseInventoryCachedOverviewResult {
  inventory: InventoryOverviewData | null;
  isLoading: boolean;
  error: Error | null;
  source: Source;
  isStale: boolean;
  ageMs: number | null;
}

/**
 * Offline-first inventory overview:
 * - Uses IndexedDB snapshot key "inventoryOverview"
 * - Cache first (instant) -> network update (fresh) when online
 * - Works offline after at least one online visit
 */
export function useInventoryCachedOverview(): UseInventoryCachedOverviewResult {
  const [inventory, setInventory] = useState<InventoryOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [isStaleState, setIsStaleState] = useState<boolean>(false);
  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      const snapshot = await loadPosSnapshot<InventoryOverviewData>('inventoryOverview');
      if (cancelled) return;
      if (snapshot) {
        setInventory(snapshot.data);
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
        // NOTE: adjust this endpoint to your real inventory overview API
        const resp = await fetch('/api/inventory', {
          headers: { Accept: 'application/json' },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load inventory overview: ${resp.status}`);
        }

        const data = (await resp.json()) as InventoryOverviewData;
        if (cancelled) return;

        setInventory(data);
        setSource('network');
        setError(null);

        void savePosSnapshot<InventoryOverviewData>('inventoryOverview', data);

        setIsStaleState(false);
        setAgeMs(0);
      } catch (err: any) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load inventory overview'));
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

  return { inventory, isLoading, error, source, isStale: isStaleState, ageMs };
}
