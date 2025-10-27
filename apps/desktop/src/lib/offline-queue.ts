/**
 * Minimal persistent offline queue using SQLite via offline-db.
 * Survives app restarts and handles corruption gracefully.
 */

import { dbEnqueue, dbCount, dbAll, dbClear } from './offline-db';

export type QueuedOp = {
  clientOpId: string; // ULID/UUIDv7
  type:
    | 'CREATE_ORDER'
    | 'ADD_ITEM'
    | 'APPLY_DISCOUNT'
    | 'SEND_TO_KITCHEN'
    | 'VOID_ORDER'
    | 'CLOSE_ORDER'
    | 'ADD_PAYMENT';
  payload: unknown;
  clientOrderId?: string;
  at: string; // ISO timestamp
};

export class OfflineQueue {
  async getAll(): Promise<QueuedOp[]> {
    return dbAll();
  }

  async getCount(): Promise<number> {
    return dbCount();
  }

  async enqueue(op: QueuedOp): Promise<void> {
    await dbEnqueue(op);
  }

  async clear(): Promise<void> {
    await dbClear();
  }

  async replaceAll(ops: QueuedOp[]): Promise<void> {
    await dbClear();
    for (const op of ops) {
      await dbEnqueue(op);
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();
