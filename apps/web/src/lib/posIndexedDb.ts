/**
 * M27-S3: POS IndexedDB Utility
 * M27-S6: Extended with staleness detection and cache lifecycle management
 * M27-S5: Extended to support backoffice snapshots (inventory + staff)
 * M28-KDS-S1: Extended to support KDS orders snapshot
 * 
 * Simple snapshot-based caching for POS menu and open orders.
 * Enables offline-first experience by storing last-known data.
 * Tracks cache age and provides TTL-based staleness detection.
 */

export type PosSnapshotKey = 'menu' | 'openOrders' | 'inventoryOverview' | 'staffOverview' | 'kdsOrders';

export interface PosSnapshot<T> {
  key: PosSnapshotKey;
  updatedAt: string; // ISO datetime
  data: T;
}

const POS_DB_NAME = 'chefcloud_pos';
const POS_DB_VERSION = 1;
const POS_SNAPSHOT_STORE = 'snapshots';

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openPosDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB is not available'));
    }

    const request = window.indexedDB.open(POS_DB_NAME, POS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POS_SNAPSHOT_STORE)) {
        db.createObjectStore(POS_SNAPSHOT_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open POS IndexedDB'));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openPosDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(POS_SNAPSHOT_STORE, mode);
    const store = tx.objectStore(POS_SNAPSHOT_STORE);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));

    tx.oncomplete = () => {
      db.close();
    };
    tx.onerror = () => {
      // We already reject on request.onerror; this is a safety net
      // eslint-disable-next-line no-console
      console.error('IndexedDB transaction error', tx.error);
    };
  });
}

export async function savePosSnapshot<T>(key: PosSnapshotKey, data: T): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  const snapshot: PosSnapshot<T> = {
    key,
    updatedAt: new Date().toISOString(),
    data,
  };

  await withStore('readwrite', store => store.put(snapshot));
}

export async function loadPosSnapshot<T>(key: PosSnapshotKey): Promise<PosSnapshot<T> | null> {
  if (!isIndexedDbAvailable()) return null;

  try {
    const result = await withStore<PosSnapshot<T> | undefined>('readonly', store =>
      store.get(key)
    );
    return result ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load POS snapshot', err);
    return null;
  }
}

export async function clearPosSnapshots(keys?: PosSnapshotKey[]): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  if (!keys || keys.length === 0) {
    // Clear entire store
    await withStore('readwrite', store => store.clear());
    return;
  }

  await Promise.all(
    keys.map(key =>
      withStore('readwrite', store => store.delete(key))
    )
  );
}

// M27-S6: Cache staleness and lifecycle helpers

// Max age in milliseconds for considering cache "fresh" (e.g. 24h)
const POS_CACHE_MAX_AGE_MS =
  (typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_POS_CACHE_MAX_AGE_HOURS
      ? Number(process.env.NEXT_PUBLIC_POS_CACHE_MAX_AGE_HOURS)
      : 24) * 60 * 60 * 1000;

export function isSnapshotStale(updatedAt: string | undefined | null): boolean {
  if (!updatedAt) return true;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return true;
  const age = Date.now() - ts;
  return age > POS_CACHE_MAX_AGE_MS;
}

export function getSnapshotAgeMs(updatedAt: string | undefined | null): number | null {
  if (!updatedAt) return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts;
}
