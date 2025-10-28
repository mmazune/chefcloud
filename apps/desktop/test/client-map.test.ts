import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadClientIdMap,
  saveClientIdMap,
  addMapping,
  getServerOrderId,
} from '../src/lib/client-map';
import * as fs from '@tauri-apps/api/fs';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/tmp/chefcloud-test-data'),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  createDir: vi.fn(async () => {}),
  readTextFile: vi.fn(async () => {
    throw new Error('File not found');
  }),
  writeTextFile: vi.fn(async () => {}),
}));

describe('Client ID Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load empty map when file does not exist', async () => {
    const map = await loadClientIdMap();
    expect(map).toEqual({});
  });

  it('should load existing map from file', async () => {
    vi.mocked(fs.readTextFile).mockResolvedValueOnce(
      JSON.stringify({ 'order-1': 'server-id-123' }),
    );

    const map = await loadClientIdMap();
    expect(map).toEqual({ 'order-1': 'server-id-123' });
  });

  it('should save map to file', async () => {
    const testMap = { 'order-2': 'server-id-456' };
    await saveClientIdMap(testMap);

    expect(fs.writeTextFile).toHaveBeenCalledWith(
      expect.stringContaining('client-map.json'),
      JSON.stringify(testMap, null, 2),
    );
  });

  it('should add new mapping and persist', async () => {
    vi.mocked(fs.readTextFile).mockResolvedValueOnce(JSON.stringify({}));

    await addMapping('order-3', 'server-id-789');

    expect(fs.writeTextFile).toHaveBeenCalledWith(
      expect.stringContaining('client-map.json'),
      JSON.stringify({ 'order-3': 'server-id-789' }, null, 2),
    );
  });

  it('should retrieve server order ID from client ID', async () => {
    vi.mocked(fs.readTextFile).mockResolvedValueOnce(
      JSON.stringify({ 'order-4': 'server-id-999' }),
    );

    const serverId = await getServerOrderId('order-4');
    expect(serverId).toBe('server-id-999');
  });

  it('should return null for unknown client ID', async () => {
    vi.mocked(fs.readTextFile).mockResolvedValueOnce(JSON.stringify({}));

    const serverId = await getServerOrderId('unknown-order');
    expect(serverId).toBeNull();
  });
});
