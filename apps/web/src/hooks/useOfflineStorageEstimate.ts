/**
 * M27-S6: Offline Storage Estimate Hook
 * 
 * Provides storage usage information via navigator.storage.estimate() API.
 * Shows approximate quota and usage for offline POS data.
 */

import { useEffect, useState } from 'react';

interface StorageEstimate {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  isSupported: boolean;
}

export function useOfflineStorageEstimate(): StorageEstimate {
  const [estimate, setEstimate] = useState<StorageEstimate>({
    usage: null,
    quota: null,
    persisted: null,
    isSupported: typeof window !== 'undefined' && !!navigator.storage,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.storage) return;

    let cancelled = false;

    async function load() {
      try {
        const [est, persisted] = await Promise.all([
          navigator.storage.estimate(),
          navigator.storage.persisted?.() ?? Promise.resolve(null),
        ]);

        if (cancelled) return;

        setEstimate({
          usage: est.usage ?? null,
          quota: est.quota ?? null,
          persisted: typeof persisted === 'boolean' ? persisted : null,
          isSupported: true,
        });
      } catch {
        if (cancelled) return;
        setEstimate(prev => ({ ...prev, isSupported: false }));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return estimate;
}
