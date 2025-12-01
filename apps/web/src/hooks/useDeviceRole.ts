// apps/web/src/hooks/useDeviceRole.ts
// M29-PWA-S2: Hook for reading/writing device role from localStorage
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DEVICE_ROLE_STORAGE_KEY,
  DEVICE_ROLE_DEFAULT,
  type DeviceRole,
} from '@/types/deviceRole';

interface UseDeviceRoleResult {
  role: DeviceRole;
  isLoaded: boolean;
  setRole: (next: DeviceRole) => void;
  clearRole: () => void;
}

export function useDeviceRole(): UseDeviceRoleResult {
  const [role, setRoleState] = useState<DeviceRole>(DEVICE_ROLE_DEFAULT);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(DEVICE_ROLE_STORAGE_KEY);
      if (!raw) {
        setRoleState(DEVICE_ROLE_DEFAULT);
        setIsLoaded(true);
        return;
      }
      const parsed = raw as DeviceRole;
      if (parsed === 'POS' || parsed === 'KDS' || parsed === 'BACKOFFICE') {
        setRoleState(parsed);
      } else {
        setRoleState(DEVICE_ROLE_DEFAULT);
      }
    } catch {
      setRoleState(DEVICE_ROLE_DEFAULT);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const persist = useCallback((next: DeviceRole) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DEVICE_ROLE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const setRole = useCallback(
    (next: DeviceRole) => {
      setRoleState(next);
      persist(next);
    },
    [persist]
  );

  const clearRole = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEVICE_ROLE_STORAGE_KEY);
    }
    setRoleState(DEVICE_ROLE_DEFAULT);
  }, []);

  return { role, isLoaded, setRole, clearRole };
}
