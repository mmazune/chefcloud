/**
 * API wrapper for offline-first operations.
 * Sends requests with Idempotency-Key or queues for later sync.
 */

import { QueuedOp, OfflineQueue } from './offline-queue';
import { dbDequeueMany, dbRemove } from './offline-db';
import { addMapping } from './client-map';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const ORG_ID = import.meta.env.VITE_ORG_ID || 'demo';

export interface BatchResultItem {
  status: 'OK' | 'SKIP' | 'ERROR';
  serverId?: string;
  message?: string;
}

export interface SendResult {
  queued: boolean;
  result?: BatchResultItem;
  error?: string;
}

/**
 * Send a single operation or queue it if offline.
 */
export async function sendOrQueue(
  op: QueuedOp,
  queue: OfflineQueue,
): Promise<SendResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': ORG_ID,
        'Idempotency-Key': op.clientOpId,
      },
      body: JSON.stringify({ ops: [op] }),
    });

    if (!response.ok) {
      // Non-2xx response - queue it
      await queue.enqueue(op);
      return {
        queued: true,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (result && (result.status === 'OK' || result.status === 'SKIP')) {
      // Update client ID mapping if we got a server ID
      if (result.serverId && op.clientOrderId) {
        await addMapping(op.clientOrderId, result.serverId);
      }
      
      return {
        queued: false,
        result,
      };
    }

    // Unexpected response - queue it
    await queue.enqueue(op);
    return {
      queued: true,
      error: result?.message || 'Unexpected response',
    };
  } catch (error) {
    // Network error - queue it
    await queue.enqueue(op);
    return {
      queued: true,
      error: (error as Error).message || 'Network error',
    };
  }
}

/**
 * Flush all queued operations to the server.
 * Processes in batches of 25, removes successfully processed ops.
 */
export async function flushAll(_queue?: OfflineQueue): Promise<{
  flushed: number;
  failed: number;
  error?: string;
}> {
  const BATCH_SIZE = 25;
  let flushed = 0;
  let failed = 0;

  // Process in batches
  let batch = await dbDequeueMany(BATCH_SIZE);
  
  while (batch.length > 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': ORG_ID,
        },
        body: JSON.stringify({ ops: batch }),
      });

      if (!response.ok) {
        // Failed to send batch - keep all ops, stop processing
        failed += batch.length;
        break;
      }

      const data = await response.json();
      const results = data.results || [];

      const successfulIds: string[] = [];
      
      // Check each result
      for (let j = 0; j < batch.length; j++) {
        const result = results[j] as BatchResultItem | undefined;
        if (result && (result.status === 'OK' || result.status === 'SKIP')) {
          flushed++;
          successfulIds.push(batch[j].clientOpId);
          
          // Update client ID mapping if we got a server ID
          const clientOrderId = batch[j].clientOrderId;
          const serverId = result.serverId;
          if (serverId && clientOrderId) {
            await addMapping(clientOrderId, serverId);
          }
        } else {
          failed++;
        }
      }

      // Remove successful ops from DB
      if (successfulIds.length > 0) {
        await dbRemove(successfulIds);
      }
      
      // Get next batch
      batch = await dbDequeueMany(BATCH_SIZE);
    } catch (error) {
      // Network error - stop processing, keep remaining ops
      failed += batch.length;
      break;
    }
  }

  return { flushed, failed };
}
