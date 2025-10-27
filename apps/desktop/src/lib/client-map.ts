/**
 * Client ID mapping: clientOrderId -> serverOrderId
 * Stored in userData/client-map.json
 */

import { appDataDir } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, createDir } from '@tauri-apps/api/fs';

type ClientIdMap = Record<string, string>;

async function getMapPath(): Promise<string> {
  const dataDir = await appDataDir();
  
  // Ensure directory exists
  try {
    await createDir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  
  return `${dataDir}/client-map.json`;
}

export async function loadClientIdMap(): Promise<ClientIdMap> {
  try {
    const mapPath = await getMapPath();
    const content = await readTextFile(mapPath);
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is corrupted, return empty map
    return {};
  }
}

export async function saveClientIdMap(map: ClientIdMap): Promise<void> {
  try {
    const mapPath = await getMapPath();
    await writeTextFile(mapPath, JSON.stringify(map, null, 2));
  } catch (error) {
    console.error('Failed to save client ID map:', error);
  }
}

export async function addMapping(clientOrderId: string, serverOrderId: string): Promise<void> {
  const map = await loadClientIdMap();
  map[clientOrderId] = serverOrderId;
  await saveClientIdMap(map);
}

export async function getServerOrderId(clientOrderId: string): Promise<string | null> {
  const map = await loadClientIdMap();
  return map[clientOrderId] ?? null;
}
