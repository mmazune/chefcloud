/**
 * Background sync loop with exponential backoff.
 * Automatically flushes queued operations every 10s when online.
 */

import { flushAll } from './api-wrapper';
import { dbCount } from './offline-db';

const SYNC_INTERVAL_MS = 10000; // 10 seconds
const MAX_BACKOFF_MS = 60000; // 60 seconds cap

let syncInterval: ReturnType<typeof setInterval> | null = null;
let currentBackoff = SYNC_INTERVAL_MS;

/**
 * Start the automatic sync loop.
 * Runs every 10s, with exponential backoff on errors.
 */
export function startSyncLoop(): void {
  if (syncInterval) {
    console.warn('Sync loop already running');
    return;
  }

  console.log('Starting sync loop (10s interval)');

  const syncOnce = async () => {
    try {
      // Check if online and have pending ops
      if (!navigator.onLine) {
        return;
      }

      const count = await dbCount();
      if (count === 0) {
        // Reset backoff when queue is empty
        currentBackoff = SYNC_INTERVAL_MS;
        return;
      }

      console.log(`Syncing ${count} pending operations...`);
      const result = await flushAll();

      if (result.flushed > 0) {
        console.log(`✓ Synced ${result.flushed} operations`);
        // Reset backoff on success
        currentBackoff = SYNC_INTERVAL_MS;
      }

      if (result.failed > 0) {
        console.warn(`⚠ ${result.failed} operations failed, will retry`);
        // Increase backoff on failure
        currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
      }
    } catch (error) {
      console.error('Sync loop error:', error);
      // Increase backoff on error
      currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
    }
  };

  // Run immediately, then on interval
  void syncOnce();

  syncInterval = setInterval(() => {
    void syncOnce();
  }, currentBackoff);
}

/**
 * Stop the automatic sync loop.
 */
export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('Stopped sync loop');
  }
}

/**
 * Get current sync loop status.
 */
export function getSyncStatus(): {
  running: boolean;
  backoffMs: number;
} {
  return {
    running: syncInterval !== null,
    backoffMs: currentBackoff,
  };
}
