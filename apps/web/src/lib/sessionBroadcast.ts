/**
 * M32-SEC-S3: Cross-tab session event broadcasting via localStorage
 *
 * When a user logs out (manual or idle) in one tab, this utility broadcasts
 * the event to all other tabs so they can immediately logout and redirect.
 */

export type SessionBroadcastEventType = 'logout' | 'login';

export interface SessionBroadcastEvent {
  type: SessionBroadcastEventType;
  at: number; // Date.now()
}

const STORAGE_KEY = 'chefcloud_session_event_v1';

/**
 * Broadcast a session event to all other open tabs via localStorage.
 * Best-effort; if localStorage is blocked, fails silently.
 */
export function broadcastSessionEvent(type: SessionBroadcastEventType): void {
  if (typeof window === 'undefined') return;

  const event: SessionBroadcastEvent = {
    type,
    at: Date.now(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
    // Swallow; cross-tab sync is best-effort
  }
}

type SessionEventCallback = (event: SessionBroadcastEvent) => void;

/**
 * Subscribe to session events from other tabs.
 * Returns an unsubscribe function to clean up the listener.
 */
export function subscribeSessionEvents(
  callback: SessionEventCallback,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as SessionBroadcastEvent;
      if (!parsed || typeof parsed.type !== 'string') return;
      callback(parsed);
    } catch {
      // Ignore malformed values
    }
  };

  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('storage', handler);
  };
}
