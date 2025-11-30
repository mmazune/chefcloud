/**
 * M27-S8: POS Sync Log IndexedDB Persistence
 * 
 * Separate database for sync history persistence across reloads.
 * Keeps sync logs independent from POS data snapshots (menu/orders).
 */

import type { SyncLogEntry } from '@/hooks/useOfflineQueue';

const POS_LOG_DB_NAME = 'chefcloud_pos_logs';
const POS_LOG_DB_VERSION = 1;
const POS_LOG_STORE = 'log';

interface SyncLogSnapshot {
  key: 'syncLog';
  data: SyncLogEntry[];
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openLogDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB is not available'));
    }

    const request = window.indexedDB.open(POS_LOG_DB_NAME, POS_LOG_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POS_LOG_STORE)) {
        db.createObjectStore(POS_LOG_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open POS log IndexedDB'));
  });
}

async function withLogStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openLogDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(POS_LOG_STORE, mode);
    const store = tx.objectStore(POS_LOG_STORE);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () =>
      reject(request.error ?? new Error('POS log IndexedDB request failed'));

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('POS log IndexedDB transaction error', tx.error);
    };
  });
}

export async function loadPersistedSyncLog(): Promise<SyncLogEntry[]> {
  if (!isIndexedDbAvailable()) return [];
  try {
    const snapshot = await withLogStore<SyncLogSnapshot | undefined>('readonly', store =>
      store.get('syncLog')
    );
    return snapshot?.data ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load persisted sync log', err);
    return [];
  }
}

export async function savePersistedSyncLog(entries: SyncLogEntry[]): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  const snapshot: SyncLogSnapshot = {
    key: 'syncLog',
    data: entries,
  };

  try {
    await withLogStore('readwrite', store => store.put(snapshot));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist sync log', err);
  }
}

export async function clearPersistedSyncLog(): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
    await withLogStore('readwrite', store => store.delete('syncLog'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear persisted sync log', err);
  }
}
