// apps/web/src/hooks/useKioskMode.ts
// M29-PWA-S1: Kiosk mode hook for fullscreen + wake lock on POS/KDS devices
'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseKioskModeResult {
  isSupported: boolean;
  isActive: boolean;
  isFullscreen: boolean;
  hasWakeLock: boolean;
  toggleKiosk: () => Promise<void>;
}

export function useKioskMode(): UseKioskModeResult {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasWakeLock, setHasWakeLock] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] =
    useState<any | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    ('fullscreenEnabled' in document || 'webkitFullscreenEnabled' in document) &&
    'wakeLock' in (navigator as any);

  // Track fullscreen changes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handler = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      setIsFullscreen(Boolean(fsElement));
    };

    document.addEventListener('fullscreenchange', handler);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - webkitfullscreenchange exists in Safari but not in TS types
    document.addEventListener('webkitfullscreenchange', handler);

    handler();

    return () => {
      document.removeEventListener('fullscreenchange', handler);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - webkitfullscreenchange exists in Safari but not in TS types
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const wl = await (navigator as any).wakeLock.request('screen');
      setWakeLockSentinel(wl);
      setHasWakeLock(true);
      wl.addEventListener('release', () => {
        setHasWakeLock(false);
        setWakeLockSentinel(null);
      });
    } catch {
      setHasWakeLock(false);
      setWakeLockSentinel(null);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        await wakeLockSentinel.release();
      }
    } catch {
      // ignore
    } finally {
      setHasWakeLock(false);
      setWakeLockSentinel(null);
    }
  }, [wakeLockSentinel]);

  const enterFullscreen = useCallback(async () => {
    const elem = document.documentElement as any;
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    }
  }, []);

  const toggleKiosk = useCallback(async () => {
    if (!isSupported) return;

    // If currently active, exit both fullscreen and wakelock
    if (isFullscreen || hasWakeLock) {
      await releaseWakeLock();
      await exitFullscreen();
      return;
    }

    // Otherwise, enter fullscreen then request wake lock
    try {
      await enterFullscreen();
    } catch {
      // ignore fullscreen errors
    }

    await requestWakeLock();
  }, [isSupported, isFullscreen, hasWakeLock, enterFullscreen, exitFullscreen, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    // Release wakeLock on page visibility changes (tab hidden)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void releaseWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [releaseWakeLock]);

  return {
    isSupported,
    isActive: isFullscreen || hasWakeLock,
    isFullscreen,
    hasWakeLock,
    toggleKiosk,
  };
}
