/**
 * M27-S1 + M27-S2 + M27-S4 + M27-S7: useOfflineQueue Hook
 * 
 * Manages offline/online state and provides queue operations for POS
 * M27-S2: Added Background Sync support and service worker coordination
 * M27-S4: Added sync status tracking and observability layer
 * M27-S7: Added conflict detection and resolution
 */

import { useEffect, useState, useCallback } from 'react';
import {
  QueuedRequest,
  loadQueue,
  enqueue,
  saveQueue,
  clearQueue as clearQueueStorage,
} from '@/lib/offlineQueue';

type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';

export interface SyncLogEntry {
  id: string;            // matches queue item id
  label: string;         // human-readable action
  createdAt: string;     // ISO datetime
  lastAttemptAt?: string;
  status: SyncStatus;
  errorMessage?: string;
  conflictDetails?: {
    reason: string;
    orderId?: string;
    serverStatus?: string;
  };
}

function describeQueuedRequest(req: { method: string; url: string }): string {
  const method = req.method.toUpperCase();

  try {
    const url = new URL(req.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const path = url.pathname;

    if (method === 'POST' && path === '/api/pos/orders') {
      return 'Create order';
    }
    if (method === 'POST' && path.match(/^\/api\/pos\/orders\/[^/]+\/items$/)) {
      return 'Add items to order';
    }
    if (method === 'PATCH' && path.match(/^\/api\/pos\/orders\/[^/]+\/items$/)) {
      return 'Update order items';
    }
    if (method === 'POST' && path.match(/^\/api\/pos\/orders\/[^/]+\/send$/)) {
      return 'Send order to kitchen';
    }
    if (method === 'POST' && path.match(/^\/api\/pos\/orders\/[^/]+\/pay$/)) {
      return 'Take payment';
    }
    if (method === 'POST' && path.match(/^\/api\/pos\/orders\/[^/]+\/void$/)) {
      return 'Void order';
    }

    // Fallback
    return `${method} ${path}`;
  } catch {
    return `${method} ${req.url}`;
  }
}

// M27-S7: Action classification for conflict detection
type QueueActionKind =
  | 'createOrder'
  | 'addItems'
  | 'updateItems'
  | 'sendToKitchen'
  | 'payOrder'
  | 'voidOrder'
  | 'other';

function parseQueueAction(req: { method: string; url: string }): { kind: QueueActionKind; orderId?: string } {
  const method = req.method.toUpperCase();

  try {
    const url = new URL(
      req.url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    const path = url.pathname;

    const matchOrderId = (regex: RegExp): string | undefined => {
      const m = path.match(regex);
      return m?.[1];
    };

    // Create order – no orderId yet
    if (method === 'POST' && path === '/api/pos/orders') {
      return { kind: 'createOrder' };
    }

    if (method === 'POST') {
      let id = matchOrderId(/^\/api\/pos\/orders\/([^/]+)\/items$/);
      if (id) return { kind: 'addItems', orderId: id };

      id = matchOrderId(/^\/api\/pos\/orders\/([^/]+)\/send$/);
      if (id) return { kind: 'sendToKitchen', orderId: id };

      id = matchOrderId(/^\/api\/pos\/orders\/([^/]+)\/pay$/);
      if (id) return { kind: 'payOrder', orderId: id };

      id = matchOrderId(/^\/api\/pos\/orders\/([^/]+)\/void$/);
      if (id) return { kind: 'voidOrder', orderId: id };
    }

    if (method === 'PATCH') {
      const id = matchOrderId(/^\/api\/pos\/orders\/([^/]+)\/items$/);
      if (id) return { kind: 'updateItems', orderId: id };
    }

    return { kind: 'other' };
  } catch {
    return { kind: 'other' };
  }
}

// M27-S7: Conflict detection via server order state check
async function checkOrderConflict(
  orderId: string,
  actionKind: QueueActionKind
): Promise<{ hasConflict: boolean; reason?: string; serverStatus?: string }> {
  if (typeof window === 'undefined') {
    return { hasConflict: false };
  }

  // Only run conflict checks for risky actions
  const riskyActions: QueueActionKind[] = ['payOrder', 'voidOrder', 'updateItems', 'addItems', 'sendToKitchen'];
  if (!riskyActions.includes(actionKind)) {
    return { hasConflict: false };
  }

  try {
    const resp = await fetch(`/api/pos/orders/${orderId}`, {
      headers: { 
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!resp.ok) {
      // If we can't read server state, just fall back to normal replay.
      return { hasConflict: false };
    }

    const order = await resp.json();
    const rawStatus = (
      order.status ?? order.state ?? order.lifecycleStatus ?? ''
    ).toString();
    const statusUpper = rawStatus.toUpperCase();

    // Treat these as final states.
    const finalStates = ['CLOSED', 'VOIDED', 'CANCELLED', 'PAID'];

    if (finalStates.includes(statusUpper)) {
      return {
        hasConflict: true,
        reason: `Order is already ${statusUpper} on server`,
        serverStatus: rawStatus,
      };
    }

    return { hasConflict: false };
  } catch {
    // Network / JSON / other error – can't confidently detect conflict
    return { hasConflict: false };
  }
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);

  // Load initial queue on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setQueue(loadQueue());
  }, []);

  // M27-S4: Helper to update sync log entry
  const updateLogStatus = useCallback(
    (id: string, updater: (entry: SyncLogEntry | null) => SyncLogEntry) => {
      setSyncLog(prev => {
        const existing = prev.find(e => e.id === id) ?? null;
        const updated = updater(existing);
        const rest = prev.filter(e => e.id !== id);
        return [...rest, updated];
      });
    },
    []
  );

  // M27-S2 + M27-S4: syncQueue function with isSyncing state and sync logging
  const syncQueue = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (queue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    setIsSyncing(true);
    try {
      let currentQueue = [...queue];

      for (const item of currentQueue) {
        const now = new Date().toISOString();

        // M27-S7: Check for conflicts before attempting sync
        const { kind, orderId } = parseQueueAction(item);
        if (orderId) {
          const conflict = await checkOrderConflict(orderId, kind);
          if (conflict.hasConflict) {
            // Conflict detected – skip this action, mark as conflict, remove from queue
            updateLogStatus(item.id, prev => ({
              id: item.id,
              label: prev?.label ?? describeQueuedRequest(item),
              createdAt: prev?.createdAt ?? (item as any).createdAt ?? now,
              status: 'conflict',
              lastAttemptAt: now,
              errorMessage: conflict.reason,
              conflictDetails: {
                reason: conflict.reason!,
                orderId: orderId,
                serverStatus: conflict.serverStatus,
              },
            }));

            // Remove from queue
            currentQueue = currentQueue.filter(q => q.id !== item.id);
            setQueue(currentQueue);
            saveQueue(currentQueue);
            continue;
          }
        }

        // M27-S4: Mark as syncing
        updateLogStatus(item.id, prev => ({
          id: item.id,
          label: prev?.label ?? describeQueuedRequest(item),
          createdAt: prev?.createdAt ?? (item as any).createdAt ?? now,
          status: 'syncing',
          lastAttemptAt: now,
          errorMessage: prev?.errorMessage,
        }));

        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.idempotencyKey,
            },
            credentials: 'include',
            body: item.body ? JSON.stringify(item.body) : undefined,
          });

          if (!res.ok) {
            // Failed but keep in queue
            const errorText = await res.text().catch(() => '');
            updateLogStatus(item.id, prev => ({
              ...(prev ?? {
                id: item.id,
                label: describeQueuedRequest(item),
                createdAt: now,
              }),
              status: 'failed',
              lastAttemptAt: now,
              errorMessage: errorText || `HTTP ${res.status}`,
            }));
            continue;
          }

          // Successfully synced - remove from queue
          currentQueue = currentQueue.filter(q => q.id !== item.id);
          setQueue(currentQueue);
          saveQueue(currentQueue);

          // M27-S4: Mark as success
          updateLogStatus(item.id, prev => ({
            ...(prev ?? {
              id: item.id,
              label: describeQueuedRequest(item),
              createdAt: now,
            }),
            status: 'success',
            lastAttemptAt: now,
            errorMessage: undefined,
          }));
        } catch (error) {
          // Network error: mark as failed and stop
          updateLogStatus(item.id, prev => ({
            ...(prev ?? {
              id: item.id,
              label: describeQueuedRequest(item),
              createdAt: now,
            }),
            status: 'failed',
            lastAttemptAt: now,
            errorMessage: error instanceof Error ? error.message : 'Network error',
          }));
          break;
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [queue, updateLogStatus]);

  // M27-S2: Background Sync scheduling helper
  const scheduleBackgroundSync = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    const isOnlineNow = typeof navigator !== 'undefined' && navigator.onLine;
    
    if (!('serviceWorker' in navigator)) {
      // Fallback: directly sync if online
      if (isOnlineNow) {
        await syncQueue();
      }
      return;
    }

    try {
      // Check if SyncManager is available
      if ('SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        // Tag must match the SW 'sync' listener
        // @ts-expect-error SyncManager not in default TS lib
        await registration.sync.register('chefcloud-pos-offline-queue-sync');
      } else if (isOnlineNow) {
        // No Background Sync support, but we are online: sync immediately
        await syncQueue();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to schedule POS background sync', err);
      if (isOnlineNow) {
        await syncQueue();
      }
    }
  }, [syncQueue]);

  // M27-S2 + M27-S4: addToQueue with Background Sync scheduling and log creation
  const addToQueue = useCallback(
    (req: Omit<QueuedRequest, 'id' | 'createdAt'>) => {
      if (typeof window === 'undefined') return;

      const updatedQueue = enqueue(req);
      const newItem = updatedQueue.find(
        q => !queue.some(existing => existing.id === q.id)
      );

      setQueue(updatedQueue);

      // M27-S4: Create log entry for new queued item
      if (newItem) {
        const now = new Date().toISOString();
        setSyncLog(prev => [
          ...prev,
          {
            id: newItem.id,
            label: describeQueuedRequest(newItem),
            createdAt: (newItem as any).createdAt ?? now,
            status: 'pending',
          },
        ]);
      }

      // Schedule sync if offline (will fire when back online)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        void scheduleBackgroundSync();
      }
    },
    [queue, scheduleBackgroundSync]
  );

  // M27-S2: Online/offline event handling with auto-sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (queue.length > 0) {
        void scheduleBackgroundSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queue.length, scheduleBackgroundSync]);

  // M27-S2: Service worker message listener for POS_SYNC_QUEUE
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'POS_SYNC_QUEUE') {
        void syncQueue();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [syncQueue]);

  // M27-S6: Clear queue and related log entries
  const clearQueue = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearQueueStorage();
    setQueue([]);
    // Keep success entries, remove pending/failed/conflict
    setSyncLog(prev =>
      prev.filter(entry => entry.status === 'success')
    );
  }, []);

  return {
    isOnline,
    isSyncing,
    queue,
    syncLog,
    addToQueue,
    syncQueue,
    clearQueue,
  };
}
