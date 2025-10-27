/**
 * SQLite-based offline queue using better-sqlite3.
 * Stores operations in userData directory for persistence across restarts.
 */

import Database from 'better-sqlite3';
import { appDataDir } from '@tauri-apps/api/path';
import { createDir } from '@tauri-apps/api/fs';
import { QueuedOp } from './offline-queue';

let db: Database.Database | null = null;

async function getDbPath(): Promise<string> {
  const dataDir = await appDataDir();
  
  // Ensure directory exists
  try {
    await createDir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  
  return `${dataDir}/offline-queue.db`;
}

async function getDb(): Promise<Database.Database> {
  if (!db) {
    const dbPath = await getDbPath();
    db = new Database(dbPath);
    
    // Create table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS ops (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        clientOrderId TEXT,
        at TEXT NOT NULL
      )
    `);
  }
  
  return db;
}

export async function dbEnqueue(op: QueuedOp): Promise<void> {
  const database = await getDb();
  const stmt = database.prepare(
    'INSERT INTO ops (id, type, payload, clientOrderId, at) VALUES (?, ?, ?, ?, ?)'
  );
  
  stmt.run(
    op.clientOpId,
    op.type,
    JSON.stringify(op.payload),
    op.clientOrderId || null,
    op.at
  );
}

export async function dbDequeueMany(limit: number): Promise<QueuedOp[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM ops LIMIT ?');
  const rows = stmt.all(limit) as any[];
  
  return rows.map((row) => ({
    clientOpId: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    clientOrderId: row.clientOrderId || undefined,
    at: row.at,
  }));
}

export async function dbRemove(clientOpIds: string[]): Promise<void> {
  if (clientOpIds.length === 0) return;
  
  const database = await getDb();
  const placeholders = clientOpIds.map(() => '?').join(',');
  const stmt = database.prepare(`DELETE FROM ops WHERE id IN (${placeholders})`);
  stmt.run(...clientOpIds);
}

export async function dbCount(): Promise<number> {
  const database = await getDb();
  const row = database.prepare('SELECT COUNT(*) as count FROM ops').get() as any;
  return row.count;
}

export async function dbAll(): Promise<QueuedOp[]> {
  const database = await getDb();
  const stmt = database.prepare('SELECT * FROM ops ORDER BY at ASC');
  const rows = stmt.all() as any[];
  
  return rows.map((row) => ({
    clientOpId: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    clientOrderId: row.clientOrderId || undefined,
    at: row.at,
  }));
}

export async function dbClear(): Promise<void> {
  const database = await getDb();
  database.prepare('DELETE FROM ops').run();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
