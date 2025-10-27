import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendOrQueue, flushAll } from '../src/lib/api-wrapper';
import { dbClear, closeDb } from '../src/lib/offline-db';
import { offlineQueue } from '../src/lib/offline-queue';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Create a real temp directory for tests
const testDir = path.join(os.tmpdir(), 'chefcloud-api-test-' + Date.now());

// Mock Tauri APIs to use real filesystem
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => testDir),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  createDir: vi.fn(async (dirPath: string, options?: { recursive?: boolean }) => {
    fs.mkdirSync(dirPath, { recursive: options?.recursive ?? false });
  }),
  readTextFile: vi.fn(async (filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      throw new Error('File not found');
    }
  }),
  writeTextFile: vi.fn(async (filePath: string, contents: string) => {
    fs.writeFileSync(filePath, contents, 'utf-8');
  }),
}));

global.fetch = vi.fn();

describe('API Wrapper with offline queue', () => {
  beforeEach(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    await dbClear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await dbClear();
    closeDb();
  });

  it('should send request when online', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ status: 'OK', serverId: 'server-123' }] }),
    } as Response);

    const result = await sendOrQueue(
      {
        clientOpId: 'op-1',
        type: 'CREATE_ORDER',
        payload: { items: ['coffee'] },
        clientOrderId: 'order-1',
        at: new Date().toISOString(),
      },
      offlineQueue
    );

    expect(result.queued).toBe(false);
    expect(result.result?.serverId).toBe('server-123');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync/batch'),
      expect.objectContaining({ method: 'POST' })
    );

    const count = await offlineQueue.getCount();
    expect(count).toBe(0);
  });

  it('should queue request when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await sendOrQueue(
      {
        clientOpId: 'op-2',
        type: 'CREATE_ORDER',
        payload: { items: ['tea'] },
        clientOrderId: 'order-2',
        at: new Date().toISOString(),
      },
      offlineQueue
    );

    expect(result.queued).toBe(true);

    const count = await offlineQueue.getCount();
    expect(count).toBe(1);

    const all = await offlineQueue.getAll();
    expect(all[0].type).toBe('CREATE_ORDER');
  });

  it('should flush queued operations when online', async () => {
    // Queue some operations
    await offlineQueue.enqueue({
      clientOpId: 'op-3',
      type: 'CREATE_ORDER',
      payload: { items: ['coffee'] },
      clientOrderId: 'order-3',
      at: new Date().toISOString(),
    });

    await offlineQueue.enqueue({
      clientOpId: 'op-4',
      type: 'CREATE_ORDER',
      payload: { items: ['tea'] },
      clientOrderId: 'order-4',
      at: new Date().toISOString(),
    });

    // Mock successful flush
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { status: 'OK', serverId: 'server-3' },
          { status: 'OK', serverId: 'server-4' },
        ],
      }),
    } as Response);

    const result = await flushAll();

    expect(result.flushed).toBe(2);
    expect(result.failed).toBe(0);

    const count = await offlineQueue.getCount();
    expect(count).toBe(0);
  });

  it('should handle partial flush failures', async () => {
    await offlineQueue.enqueue({
      clientOpId: 'op-5',
      type: 'CREATE_ORDER',
      payload: { items: ['coffee'] },
      clientOrderId: 'order-5',
      at: new Date().toISOString(),
    });

    await offlineQueue.enqueue({
      clientOpId: 'op-6',
      type: 'CREATE_ORDER',
      payload: { items: ['tea'] },
      clientOrderId: 'order-6',
      at: new Date().toISOString(),
    });

    // Mock first success, second failure
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { status: 'OK', serverId: 'server-5' },
            { status: 'ERROR', message: 'Server error' },
          ],
        }),
      } as Response)
      .mockRejectedValueOnce(new Error('Server error'));

    const result = await flushAll();

    expect(result.flushed).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
  });
});
