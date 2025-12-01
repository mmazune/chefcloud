// apps/web/src/hooks/useKdsPreferences.ts
// M28-KDS-S4: KDS Settings & Local Preferences
// Hook for managing per-device KDS preferences in localStorage
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  KdsPreferences,
  defaultKdsPreferences,
  KDS_PREFERENCES_STORAGE_KEY,
  sanitizeKdsPreferences,
} from '@/types/kds';

interface UseKdsPreferencesResult {
  prefs: KdsPreferences;
  isLoaded: boolean;
  updatePrefs: (updater: (prev: KdsPreferences) => KdsPreferences) => void;
  resetPrefs: () => void;
}

export function useKdsPreferences(): UseKdsPreferencesResult {
  const [prefs, setPrefs] = useState<KdsPreferences>(defaultKdsPreferences);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial load from localStorage with M28-KDS-S7 sanitization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(KDS_PREFERENCES_STORAGE_KEY);
      if (!raw) {
        setPrefs(defaultKdsPreferences);
        setIsLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<KdsPreferences>;
      const safe = sanitizeKdsPreferences(parsed);
      setPrefs(safe);
    } catch {
      setPrefs(defaultKdsPreferences);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const persist = useCallback((next: KdsPreferences) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KDS_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / storage errors for now
    }
  }, []);

  const updatePrefs = useCallback(
    (updater: (prev: KdsPreferences) => KdsPreferences) => {
      setPrefs(prev => {
        const nextRaw = updater(prev);
        const next = sanitizeKdsPreferences(nextRaw);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetPrefs = useCallback(() => {
    setPrefs(defaultKdsPreferences);
    persist(defaultKdsPreferences);
  }, [persist]);

  return { prefs, isLoaded, updatePrefs, resetPrefs };
}
