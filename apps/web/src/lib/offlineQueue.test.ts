/**
 * M27-S9: Tests for offlineQueue.ts
 * 
 * Validates localStorage-based queue behavior:
 * - enqueue adds items with generated id/idempotencyKey
 * - clearQueue removes all data
 * - removeById filters specific items
 */

import {
  loadQueue,
  saveQueue,
  enqueue,
  clearQueue,
  removeById,
} from './offlineQueue';

const STORAGE_KEY = 'chefcloud_pos_offline_queue_v1';

function getRawStorage(): any[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('offlineQueue', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('loadQueue returns empty array when storage is empty', () => {
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });

  test('enqueue adds new request and persists it', () => {
    const before = loadQueue();
    expect(before).toEqual([]);

    const req = {
      url: '/api/pos/orders',
      method: 'POST' as const,
      body: { table: 'T1' },
      idempotencyKey: 'test-key-123',
    };

    const updated = enqueue(req);
    expect(updated).toHaveLength(1);

    const [first] = updated;
    expect(first.id).toBeDefined();
    expect(first.idempotencyKey).toBe('test-key-123');
    expect(first.url).toBe('/api/pos/orders');
    expect(first.createdAt).toBeGreaterThan(0);

    const stored = getRawStorage();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(first.id);
  });

  test('enqueue generates unique IDs for multiple items', () => {
    const req1 = {
      url: '/api/pos/orders',
      method: 'POST' as const,
      idempotencyKey: 'key-1',
    };

    const req2 = {
      url: '/api/pos/orders/123/pay',
      method: 'POST' as const,
      idempotencyKey: 'key-2',
    };

    enqueue(req1);
    const queue = enqueue(req2);

    expect(queue).toHaveLength(2);
    expect(queue[0].id).not.toBe(queue[1].id);
  });

  test('saveQueue persists array to localStorage', () => {
    const items = [
      {
        id: 'q1',
        url: '/api/pos/orders',
        method: 'POST' as const,
        idempotencyKey: 'key-1',
        createdAt: Date.now(),
      },
    ];

    saveQueue(items);

    const stored = getRawStorage();
    expect(stored).toEqual(items);
  });

  test('clearQueue removes everything from storage', () => {
    enqueue({ url: '/api/pos/orders', method: 'POST', idempotencyKey: 'key-1' });
    expect(loadQueue()).toHaveLength(1);

    clearQueue();
    expect(loadQueue()).toEqual([]);
    expect(getRawStorage()).toEqual([]);
  });

  test('removeById filters out specific item', () => {
    const q1 = enqueue({
      url: '/api/pos/orders',
      method: 'POST',
      idempotencyKey: 'key-1',
    });
    const id1 = q1[0].id;

    const q2 = enqueue({
      url: '/api/pos/orders/123/pay',
      method: 'POST',
      idempotencyKey: 'key-2',
    });
    const id2 = q2[1].id;

    expect(q2).toHaveLength(2);

    const after = removeById(id1);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(id2);
  });

  test('loadQueue handles corrupted storage gracefully', () => {
    window.localStorage.setItem(STORAGE_KEY, 'invalid-json{');
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });

  test('loadQueue handles non-array storage gracefully', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    const queue = loadQueue();
    expect(queue).toEqual([]);
  });
});
