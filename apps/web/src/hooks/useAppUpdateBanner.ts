/**
 * M29-PWA-S3: App Update Banner Hook
 * 
 * Detects when a new service worker version is available and provides
 * controls to acknowledge or reload with the update.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { registerPosServiceWorker } from '@/lib/registerPosServiceWorker';

interface UseAppUpdateBannerResult {
  hasUpdate: boolean;
  acknowledgeUpdate: () => void;
  reloadWithUpdate: () => Promise<void>;
}

export function useAppUpdateBanner(): UseAppUpdateBannerResult {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingRegistration, setWaitingRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    registerPosServiceWorker({
      onUpdateAvailable: () => {
        // Try to fetch the registration and keep a handle to the waiting SW
        navigator.serviceWorker
          .getRegistration('/sw-pos.js')
          .then(reg => {
            if (!reg) {
              setHasUpdate(true);
              setWaitingRegistration(null);
              return;
            }
            setHasUpdate(true);
            setWaitingRegistration(reg);
          })
          .catch(() => {
            setHasUpdate(true);
            setWaitingRegistration(null);
          });
      },
    });
  }, []);

  const acknowledgeUpdate = useCallback(() => {
    setHasUpdate(false);
  }, []);

  const reloadWithUpdate = useCallback(async () => {
    try {
      if (waitingRegistration && waitingRegistration.waiting) {
        waitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {
      // ignore messaging errors
    } finally {
      // Reload so the new SW version takes control
      window.location.reload();
    }
  }, [waitingRegistration]);

  return { hasUpdate, acknowledgeUpdate, reloadWithUpdate };
}
