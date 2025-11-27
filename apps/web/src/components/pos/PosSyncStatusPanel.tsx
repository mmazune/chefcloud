/**
 * M27-S4: POS Sync Status Panel
 * M27-S6: Extended with offline data management and cache lifecycle
 * M27-S7: Extended with conflict detection and display
 * 
 * Slide-out panel showing detailed sync status for offline actions.
 * Provides visibility into pending, syncing, successful, failed, and conflicted actions.
 * Shows storage usage, cache age, and manual cache clearing controls.
 */

'use client';

import React from 'react';
import type { SyncLogEntry } from '@/hooks/useOfflineQueue';

interface PosSyncStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  syncLog: SyncLogEntry[];
  onRetryAll: () => void;
  // M27-S6: Cache management props
  onClearSnapshots: () => void;
  onClearQueue: () => void;
  menuAgeMs: number | null;
  menuIsStale: boolean;
  openOrdersAgeMs: number | null;
  openOrdersIsStale: boolean;
  storageEstimate: {
    usage: number | null;
    quota: number | null;
    persisted: boolean | null;
    isSupported: boolean;
  };
}

function statusBadgeColor(status: SyncLogEntry['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'syncing':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'success':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'conflict':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export function PosSyncStatusPanel({
  isOpen,
  onClose,
  isSyncing,
  syncLog,
  onRetryAll,
  onClearSnapshots,
  onClearQueue,
  menuAgeMs,
  menuIsStale,
  openOrdersAgeMs,
  openOrdersIsStale,
  storageEstimate,
}: PosSyncStatusPanelProps) {
  if (!isOpen) return null;

  const sortedLog = [...syncLog].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  );

  const hasFailures = sortedLog.some(e => e.status === 'failed');
  const hasConflicts = sortedLog.some(e => e.status === 'conflict');

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <aside className="w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              POS Sync Status
            </h2>
            <p className="text-xs text-slate-500">
              Track offline actions and background synchronization.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </header>

        <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2 py-0.5 text-slate-700">
            <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            {isSyncing ? 'Syncing…' : 'Idle'}
          </span>
          {hasFailures && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-red-50 px-2 py-0.5 text-red-700 border-red-200">
              ⚠︎ Failed actions present
            </span>
          )}
          {hasConflicts && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-orange-50 px-2 py-0.5 text-orange-700 border-orange-200">
              ⚠︎ Conflicts detected
            </span>
          )}
          {syncLog.length === 0 && (
            <span className="text-slate-400">
              No offline actions yet this session.
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {syncLog.length === 0 ? (
            <p className="text-xs text-slate-500">
              Offline actions and sync attempts will appear here with their status.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedLog.map(entry => (
                <li
                  key={entry.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-900">
                      {entry.label}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeColor(entry.status)}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span>Created: {new Date(entry.createdAt).toLocaleTimeString()}</span>
                    {entry.lastAttemptAt && (
                      <span>Last attempt: {new Date(entry.lastAttemptAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                  {entry.errorMessage && (
                    <p className={`mt-1 text-[10px] line-clamp-2 ${
                      entry.status === 'conflict' ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {entry.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* M27-S6: Offline data & cache management */}
        <div className="border-t border-slate-200 px-4 py-3 text-xs">
          <h3 className="mb-2 text-[11px] font-semibold text-slate-900 uppercase tracking-wide">
            Offline data & cache
          </h3>

          <div className="space-y-2">
            {/* Storage estimate */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Storage usage</span>
              {storageEstimate.isSupported && storageEstimate.usage != null && storageEstimate.quota != null ? (
                <span className="text-slate-900">
                  {Math.round(storageEstimate.usage / 1024)} KB /{' '}
                  {Math.round(storageEstimate.quota / 1024 / 1024)} MB
                </span>
              ) : (
                <span className="text-slate-400">Not available</span>
              )}
            </div>

            {/* Menu cache age */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Menu cache age</span>
              <span className={`text-slate-900 ${menuIsStale ? 'text-orange-700' : ''}`}>
                {menuAgeMs == null
                  ? 'No cache'
                  : `${Math.floor(menuAgeMs / 60000)} min${menuIsStale ? ' (stale)' : ''}`}
              </span>
            </div>

            {/* Open orders cache age */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Open orders cache age</span>
              <span className={`text-slate-900 ${openOrdersIsStale ? 'text-orange-700' : ''}`}>
                {openOrdersAgeMs == null
                  ? 'No cache'
                  : `${Math.floor(openOrdersAgeMs / 60000)} min${openOrdersIsStale ? ' (stale)' : ''}`}
              </span>
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClearSnapshots}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Clear cached POS data
              </button>
              <button
                type="button"
                onClick={onClearQueue}
                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
              >
                Clear offline queue
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isSyncing || !hasFailures}
            onClick={onRetryAll}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Retry failed
          </button>
        </footer>
      </aside>
    </div>
  );
}
