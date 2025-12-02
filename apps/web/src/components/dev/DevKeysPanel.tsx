/**
 * DevKeysPanel Component
 * E23-DEVPORTAL-FE-S1: Manage API keys (list, create, revoke)
 */

import React, { useState } from 'react';
import { DevApiKeyDto, DevEnvironment } from '@/types/devPortal';
import { useCreateDevApiKey } from '@/hooks/useCreateDevApiKey';
import { useRevokeDevApiKey } from '@/hooks/useRevokeDevApiKey';

interface Props {
  keys: DevApiKeyDto[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export const DevKeysPanel: React.FC<Props> = ({
  keys,
  isLoading,
  error,
  onRefresh,
}) => {
  const [isCreatingDialogOpen, setIsCreatingDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [environment, setEnvironment] = useState<DevEnvironment>('SANDBOX');

  const { isCreating, error: createError, createKey } = useCreateDevApiKey(() => {
    setIsCreatingDialogOpen(false);
    setLabel('');
    onRefresh();
  });

  const { isRevoking, error: revokeError, revokeKey } = useRevokeDevApiKey(() => {
    onRefresh();
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await createKey({ label: label.trim(), environment });
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    await revokeKey(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-400">
          API keys are used by integrations to authenticate against ChefCloud APIs.
          Keep production keys secret and rotate them regularly.
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
          onClick={() => setIsCreatingDialogOpen(true)}
          disabled={isCreating}
        >
          New API key
        </button>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
          Loading API keys…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
          Failed to load API keys: {error.message}
        </div>
      )}

      {!isLoading && !error && keys.length === 0 && (
        <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
          No API keys yet. Create your first key to start integrating.
        </div>
      )}

      {!isLoading && !error && keys.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Label</th>
                <th className="px-4 py-2 text-left">Environment</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Last used</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/50">
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-slate-900">
                  <td className="px-4 py-2 text-slate-100">{key.label}</td>
                  <td className="px-4 py-2 text-xs uppercase text-slate-300">
                    {key.environment === 'PRODUCTION' ? (
                      <span className="rounded-full bg-rose-900/40 px-2 py-0.5 text-rose-200">
                        PRODUCTION
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">
                        SANDBOX
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {key.status === 'ACTIVE' ? (
                      <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-300">
                    {key.truncatedKey}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {new Date(key.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {key.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => void handleRevoke(key.id)}
                        disabled={isRevoking}
                        className="rounded-md border border-rose-800 px-3 py-1 text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreatingDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              New API key
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Give the key a descriptive label and choose the environment.
            </p>

            <form className="space-y-3" onSubmit={handleCreate}>
              <div className="space-y-1 text-xs">
                <label className="text-slate-300">Label</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Pourify integration"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-slate-300">Environment</label>
                <div className="inline-flex rounded-full border border-slate-700 p-0.5">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${
                      environment === 'SANDBOX'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-300'
                    }`}
                    onClick={() => setEnvironment('SANDBOX')}
                  >
                    Sandbox
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${
                      environment === 'PRODUCTION'
                        ? 'bg-rose-500 text-black'
                        : 'text-slate-300'
                    }`}
                    onClick={() => setEnvironment('PRODUCTION')}
                  >
                    Production
                  </button>
                </div>
              </div>

              {(createError || revokeError) && (
                <div className="rounded border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
                  {createError?.message || revokeError?.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => setIsCreatingDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
                  disabled={isCreating || !label.trim()}
                >
                  {isCreating ? 'Creating…' : 'Create key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
