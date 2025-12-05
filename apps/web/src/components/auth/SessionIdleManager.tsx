/**
 * M32-SEC-S1 + M32-SEC-S3: Session idle manager with cross-tab sync
 * Detects user inactivity and triggers logout after configured timeout
 * Broadcasts logout events to other tabs and reacts to remote logouts
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getSessionIdleConfig } from '@/lib/sessionIdleConfig';
import { SessionIdleWarningDialog } from './SessionIdleWarningDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  broadcastSessionEvent,
  subscribeSessionEvents,
} from '@/lib/sessionBroadcast';

interface Props {
  children?: React.ReactNode;
}

export const SessionIdleManager: React.FC<Props> = ({ children }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const config = getSessionIdleConfig();

  const isAuthenticated = user !== null;

  const [showWarning, setShowWarning] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimeoutRef = useRef<number | null>(null);
  const logoutTimeoutRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (warningTimeoutRef.current !== null) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current !== null) {
      window.clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  };

  const scheduleTimers = () => {
    clearTimers();
    if (!config.enabled || !isAuthenticated) return;

    const now = Date.now();
    lastActivityRef.current = now;

    warningTimeoutRef.current = window.setTimeout(() => {
      setShowWarning(true);
    }, config.idleMs - config.warningMs);

    logoutTimeoutRef.current = window.setTimeout(async () => {
      setShowWarning(false);

      // M32-SEC-S3: broadcast to other tabs before local logout
      broadcastSessionEvent('logout');

      try {
        await logout();
      } finally {
        // Redirect to login or root
        router.push('/login');
      }
    }, config.idleMs);
  };

  const handleActivity = () => {
    if (!config.enabled || !isAuthenticated) return;
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    scheduleTimers();
  };

  useEffect(() => {
    if (!config.enabled || !isAuthenticated) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    scheduleTimers();

    const events: (keyof DocumentEventMap)[] = [
      'keydown',
      'mousedown',
      'mousemove',
      'touchstart',
      'visibilitychange',
    ];

    const handler = (event: Event) => {
      if (event.type === 'visibilitychange') {
        if (document.visibilityState === 'visible') {
          handleActivity();
        }
        return;
      }
      handleActivity();
    };

    events.forEach((eventName) => {
      document.addEventListener(eventName, handler);
    });

    // M32-SEC-S3: subscribe to cross-tab session events
    const unsubscribeSession = subscribeSessionEvents(async (evt) => {
      if (evt.type === 'logout') {
        // Another tab has logged out; mirror that here
        clearTimers();
        setShowWarning(false);
        try {
          await logout();
        } finally {
          router.push('/login');
        }
      }
    });

    return () => {
      clearTimers();
      events.forEach((eventName) => {
        document.removeEventListener(eventName, handler);
      });
      unsubscribeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, config.enabled, config.idleMs, config.warningMs]);

  const minutesUntilLogout = Math.max(
    1,
    Math.round(config.warningMs / (60 * 1000)),
  );

  const handleStaySignedIn = () => {
    handleActivity();
  };

  const handleLogoutNow = async () => {
    setShowWarning(false);
    clearTimers();

    // M32-SEC-S3: broadcast explicit logout to other tabs
    broadcastSessionEvent('logout');

    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  return (
    <>
      {children}
      <SessionIdleWarningDialog
        isOpen={config.enabled && isAuthenticated && showWarning}
        minutesUntilLogout={minutesUntilLogout}
        onStaySignedIn={handleStaySignedIn}
        onLogoutNow={handleLogoutNow}
      />
    </>
  );
};
