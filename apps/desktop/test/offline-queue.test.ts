import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { offlineQueue } from '../src/lib/offline-queue';
import { dbClear, closeDb } from '../src/lib/offline-db';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Create a real temp directory for tests
const testDir = path.join(os.tmpdir(), 'chefcloud-test-' + Date.now());

// Mock Tauri APIs to use real filesystem
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => testDir),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  createDir: vi.fn(async (dirPath: string, options?: { recursive?: boolean }) => {
    fs.mkdirSync(dirPath, { recursive: options?.recursive ?? false });
  }),
  readTextFile: vi.fn(async (filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  }),
  writeTextFile: vi.fn(async (filePath: string, contents: string) => {
    fs.writeFileSync(filePath, contents, 'utf-8');
  }),
}));

describe('OfflineQueue SQLite persistence', () => {
  beforeEach(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    await dbClear();
  });

  afterEach(async () => {
    await dbClear();
    closeDb();
  });

  it('should start with an empty queue', async () => {
    const count = await offlineQueue.getCount();
    expect(count).toBe(0);
  });

  it('should enqueue and count operations', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-1',
      type: 'CREATE_ORDER',
      payload: { items: ['coffee'], total: 5.0 },
      clientOrderId: 'order-1',
      at: new Date().toISOString(),
    });

    const count = await offlineQueue.getCount();
    expect(count).toBe(1);
  });

  it('should retrieve all operations in order', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-2',
      type: 'CREATE_ORDER',
      payload: { items: ['coffee'] },
      clientOrderId: 'order-1',
      at: new Date().toISOString(),
    });

    await offlineQueue.enqueue({
      clientOpId: 'op-3',
      type: 'ADD_ITEM',
      payload: { sku: 'SKU123', qty: -1 },
      at: new Date().toISOString(),
    });

    const all = await offlineQueue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].type).toBe('CREATE_ORDER');
    expect(all[1].type).toBe('ADD_ITEM');
  });

  it('should clear all operations', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-4',
      type: 'CREATE_ORDER',
      payload: { items: ['tea'] },
      clientOrderId: 'order-2',
      at: new Date().toISOString(),
    });

    let count = await offlineQueue.getCount();
    expect(count).toBe(1);

    await offlineQueue.clear();

    count = await offlineQueue.getCount();
    expect(count).toBe(0);
  });

  it('should replace all operations', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-5',
      type: 'VOID_ORDER',
      payload: {},
      at: new Date().toISOString(),
    });

    const newOps = [
      {
        clientOpId: 'new-op-1',
        type: 'CREATE_ORDER' as const,
        payload: { items: ['coffee'] },
        clientOrderId: 'order-3',
        at: new Date().toISOString(),
      },
      {
        clientOpId: 'new-op-2',
        type: 'CREATE_ORDER' as const,
        payload: { items: ['tea'] },
        clientOrderId: 'order-4',
        at: new Date().toISOString(),
      },
    ];

    await offlineQueue.replaceAll(newOps);

    const all = await offlineQueue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].clientOpId).toBe('new-op-1');
    expect(all[1].clientOpId).toBe('new-op-2');
  });

  it('should persist operations across getDb() calls (simulated restart)', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-6',
      type: 'CREATE_ORDER',
      payload: { items: ['latte'] },
      clientOrderId: 'order-5',
      at: new Date().toISOString(),
    });

    // Close DB connection to simulate app restart
    closeDb();

    // Re-query - should reload from disk
    const count = await offlineQueue.getCount();
    expect(count).toBe(1);

    const all = await offlineQueue.getAll();
    expect(all[0].type).toBe('CREATE_ORDER');
    expect(all[0].clientOrderId).toBe('order-5');
  });
});
