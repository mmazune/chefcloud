/**
 * DevDebugPanel - V2.1.1 Patch
 * Developer-only debug panel that shows:
 * - Current user email + role level
 * - Active orgId + branchId
 * - Active date range
 * - Last 10 API calls with status and row count
 * 
 * Only visible in development or with ?debug=1 query param
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { X, ChevronDown, ChevronUp, Bug, Copy, Check } from 'lucide-react';

interface ApiLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  status: number;
  rowCount: number | null;
  duration: number;
  error?: string;
}

// Global API log storage (max 50 entries)
const apiLogStore: ApiLogEntry[] = [];
const API_LOG_MAX = 50;

// Add to log (called from api.ts interceptors)
export function logApiCall(entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) {
  const newEntry: ApiLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(),
  };
  apiLogStore.unshift(newEntry);
  if (apiLogStore.length > API_LOG_MAX) {
    apiLogStore.pop();
  }
  // Dispatch custom event for real-time updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chefcloud-api-log', { detail: newEntry }));
  }
}

export function getApiLog(): ApiLogEntry[] {
  return [...apiLogStore];
}

interface DevDebugPanelProps {
  dateRange?: { from: string; to: string };
}

export function DevDebugPanel({ dateRange }: DevDebugPanelProps) {
  const { user } = useAuth();
  const { activeBranchId, activeBranch, branches, isMultiBranch } = useActiveBranch();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only render on client to avoid hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if we should show the panel
  const shouldShow = isMounted && (
    process.env.NODE_ENV !== 'production' ||
    new URLSearchParams(window.location.search).get('debug') === '1'
  );

  // Subscribe to API log updates
  useEffect(() => {
    if (!shouldShow || typeof window === 'undefined') return;

    setApiLog(getApiLog());

    const handleLogUpdate = () => {
      setApiLog(getApiLog());
    };

    window.addEventListener('chefcloud-api-log', handleLogUpdate);
    return () => window.removeEventListener('chefcloud-api-log', handleLogUpdate);
  }, [shouldShow]);

  const copyContext = useCallback(() => {
    const context = {
      user: user ? {
        email: user.email,
        roleLevel: user.roleLevel,
        orgId: user.org?.id,
        orgName: user.org?.name,
        branchId: user.branch?.id,
        branchName: user.branch?.name,
      } : null,
      activeBranch: {
        id: activeBranchId,
        name: activeBranch?.name,
      },
      isMultiBranch,
      branchCount: branches.length,
      dateRange,
      recentApiCalls: apiLog.slice(0, 5).map(e => ({
        path: e.path,
        status: e.status,
        rows: e.rowCount,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(context, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [user, activeBranchId, activeBranch, isMultiBranch, branches, dateRange, apiLog]);

  if (!shouldShow) return null;

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 400 && status < 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[9999] bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full shadow-lg transition-all"
          title="Open Debug Panel"
        >
          <Bug className="h-5 w-5" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[9999] w-96 max-h-[70vh] bg-gray-900 text-gray-100 rounded-lg shadow-2xl border border-gray-700 overflow-hidden font-mono text-xs">
          {/* Header */}
          <div className="flex items-center justify-between bg-purple-700 px-3 py-2">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <span className="font-semibold">ChefCloud Debug</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyContext}
                className="p-1 hover:bg-purple-600 rounded"
                title="Copy context to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:bg-purple-600 rounded"
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-purple-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="p-3 space-y-3 overflow-y-auto max-h-[60vh]">
              {/* User Info */}
              <section>
                <h4 className="text-purple-400 font-semibold mb-1">👤 User</h4>
                <div className="bg-gray-800 rounded p-2 space-y-1">
                  <div><span className="text-gray-400">Email:</span> {user?.email || 'Not logged in'}</div>
                  <div><span className="text-gray-400">Role:</span> <span className="text-cyan-400">{user?.roleLevel || '-'}</span></div>
                  <div><span className="text-gray-400">Display:</span> {user?.displayName || '-'}</div>
                </div>
              </section>

              {/* Org & Branch */}
              <section>
                <h4 className="text-purple-400 font-semibold mb-1">🏢 Org & Branch</h4>
                <div className="bg-gray-800 rounded p-2 space-y-1">
                  <div><span className="text-gray-400">Org ID:</span> <span className="text-yellow-300 break-all">{user?.org?.id || '-'}</span></div>
                  <div><span className="text-gray-400">Org Name:</span> {user?.org?.name || '-'}</div>
                  <div className="border-t border-gray-700 pt-1 mt-1">
                    <span className="text-gray-400">Active Branch:</span>{' '}
                    <span className="text-green-400">{activeBranch?.name || 'None'}</span>
                  </div>
                  <div><span className="text-gray-400">Branch ID:</span> <span className="text-yellow-300 break-all">{activeBranchId || '-'}</span></div>
                  <div><span className="text-gray-400">Multi-Branch:</span> {isMultiBranch ? '✅ Yes' : '❌ No'} ({branches.length} branches)</div>
                </div>
              </section>

              {/* Date Range */}
              {dateRange && (
                <section>
                  <h4 className="text-purple-400 font-semibold mb-1">📅 Date Range</h4>
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-400">From:</span> {dateRange.from} → <span className="text-gray-400">To:</span> {dateRange.to}
                  </div>
                </section>
              )}

              {/* API Log */}
              <section>
                <h4 className="text-purple-400 font-semibold mb-1">📡 API Calls (Last 10)</h4>
                <div className="bg-gray-800 rounded overflow-hidden">
                  {apiLog.length === 0 ? (
                    <div className="p-2 text-gray-500">No API calls logged yet</div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-750">
                        <tr className="text-left text-gray-400">
                          <th className="px-2 py-1">Method</th>
                          <th className="px-2 py-1">Path</th>
                          <th className="px-2 py-1">Status</th>
                          <th className="px-2 py-1">Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiLog.slice(0, 10).map((entry) => (
                          <tr key={entry.id} className="border-t border-gray-700 hover:bg-gray-750">
                            <td className="px-2 py-1 text-blue-400">{entry.method}</td>
                            <td className="px-2 py-1 truncate max-w-[150px]" title={entry.path}>{entry.path}</td>
                            <td className={`px-2 py-1 ${statusColor(entry.status)}`}>{entry.status}</td>
                            <td className="px-2 py-1">{entry.rowCount ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
