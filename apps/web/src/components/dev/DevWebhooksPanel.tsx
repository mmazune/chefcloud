/**
 * DevWebhooksPanel component for E23-DEVPORTAL-FE-S2
 * Manages webhook endpoints (create, edit, enable/disable, rotate secret, test)
 */

import React, { useMemo, useState } from 'react';
import {
  DevWebhookEndpointDto,
  DevWebhookEnvironment,
  DevWebhookStatus,
} from '@/types/devPortal';
import { useDevWebhooks } from '@/hooks/useDevWebhooks';
import { useCreateDevWebhook } from '@/hooks/useCreateDevWebhook';
import { useUpdateDevWebhook } from '@/hooks/useUpdateDevWebhook';
import { useRotateDevWebhookSecret } from '@/hooks/useRotateDevWebhookSecret';
import { useSendDevWebhookTest } from '@/hooks/useSendDevWebhookTest';
import { DevWebhookDeliveryPanel } from '@/components/dev/DevWebhookDeliveryPanel';

export const DevWebhooksPanel: React.FC = () => {
  const { webhooks, isLoading, error, reload } = useDevWebhooks();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] =
    useState<DevWebhookEndpointDto | null>(null);

  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [environment, setEnvironment] =
    useState<DevWebhookEnvironment>('SANDBOX');
  const [status, setStatus] = useState<DevWebhookStatus>('ACTIVE');

  // E23-S3: Delivery panel state
  const [deliveryPanelEndpoint, setDeliveryPanelEndpoint] =
    useState<DevWebhookEndpointDto | null>(null);
  const [isDeliveryPanelOpen, setIsDeliveryPanelOpen] = useState(false);

  const { isCreating, error: createError, createWebhook } =
    useCreateDevWebhook(() => {
      setIsModalOpen(false);
      reload();
    });

  const { isUpdating, error: updateError, updateWebhook } =
    useUpdateDevWebhook(() => {
      setIsModalOpen(false);
      reload();
    });

  const { isRotating, error: rotateError, rotateSecret } =
    useRotateDevWebhookSecret(() => {
      reload();
    });

  const { isSending, error: testError, lastResult, sendTest } =
    useSendDevWebhookTest();

  const formError = createError || updateError || rotateError || testError;

  function openCreate() {
    setEditingEndpoint(null);
    setLabel('');
    setUrl('');
    setEnvironment('SANDBOX');
    setStatus('ACTIVE');
    setIsModalOpen(true);
  }

  function openEdit(endpoint: DevWebhookEndpointDto) {
    setEditingEndpoint(endpoint);
    setLabel(endpoint.label);
    setUrl(endpoint.url);
    setEnvironment(endpoint.environment);
    setStatus(endpoint.status);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;

    if (editingEndpoint) {
      await updateWebhook(editingEndpoint.id, {
        label: label.trim(),
        url: url.trim(),
        status,
      });
    } else {
      await createWebhook({
        label: label.trim(),
        url: url.trim(),
        environment,
      });
    }
  }

  async function handleToggleStatus(endpoint: DevWebhookEndpointDto) {
    const nextStatus: DevWebhookStatus =
      endpoint.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    await updateWebhook(endpoint.id, {
      label: endpoint.label,
      url: endpoint.url,
      status: nextStatus,
    });
  }

  async function handleRotateSecret(endpoint: DevWebhookEndpointDto) {
    if (
      !confirm(
        'Rotate secret for this endpoint? Existing integrations using the old secret will start failing.',
      )
    ) {
      return;
    }
    await rotateSecret(endpoint.id);
  }

  async function handleSendTest(endpoint: DevWebhookEndpointDto) {
    await sendTest({
      endpointId: endpoint.id,
      eventType: 'test.event',
    });
  }

  // E23-S3: Delivery panel handlers
  function openDeliveryPanel(endpoint: DevWebhookEndpointDto) {
    setDeliveryPanelEndpoint(endpoint);
    setIsDeliveryPanelOpen(true);
  }

  function closeDeliveryPanel() {
    setIsDeliveryPanelOpen(false);
  }

  const sortedWebhooks = useMemo(
    () =>
      [...webhooks].sort((a, b) =>
        a.environment === b.environment
          ? a.label.localeCompare(b.label)
          : a.environment.localeCompare(b.environment),
      ),
    [webhooks],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-400">
          Webhooks let ChefCloud notify your systems when important events
          happen. Configure URLs, environments and secrets here, then verify
          delivery with test events.
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
          onClick={openCreate}
          disabled={isCreating || isUpdating}
        >
          New endpoint
        </button>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
          Loading webhooks…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
          Failed to load webhooks: {error.message}
        </div>
      )}

      {!isLoading && !error && sortedWebhooks.length === 0 && (
        <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
          No webhook endpoints defined yet. Create your first endpoint to start
          receiving events.
        </div>
      )}

      {!isLoading && !error && sortedWebhooks.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Label</th>
                <th className="px-4 py-2 text-left">Environment</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">URL</th>
                <th className="px-4 py-2 text-left">Secret</th>
                <th className="px-4 py-2 text-left">Last delivery</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/50">
              {sortedWebhooks.map((wh) => (
                <tr key={wh.id} className="border-t border-slate-900">
                  <td className="px-4 py-2 text-slate-100">{wh.label}</td>
                  <td className="px-4 py-2 text-xs uppercase text-slate-300">
                    {wh.environment === 'PRODUCTION' ? (
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
                    {wh.status === 'ACTIVE' ? (
                      <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-300">
                    <span className="break-all">{wh.url}</span>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-slate-300">
                    {wh.secretSuffix ? `****${wh.secretSuffix}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {wh.lastDeliveryAt ? (
                      <>
                        {new Date(wh.lastDeliveryAt).toLocaleString()}
                        {wh.lastDeliveryStatusCode && (
                          <span className="ml-1 text-slate-500">
                            ({wh.lastDeliveryStatusCode})
                          </span>
                        )}
                      </>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                        onClick={() => openEdit(wh)}
                        disabled={isCreating || isUpdating}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                        onClick={() => void handleToggleStatus(wh)}
                        disabled={isUpdating}
                      >
                        {wh.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                        onClick={() => void handleRotateSecret(wh)}
                        disabled={isRotating}
                      >
                        Rotate secret
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-emerald-600 px-2 py-1 text-emerald-300 hover:bg-emerald-900/30"
                        onClick={() => void handleSendTest(wh)}
                        disabled={isSending}
                      >
                        Send test
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                        onClick={() => openDeliveryPanel(wh)}
                      >
                        View log
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastResult && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-100">
            Last test delivery
          </div>
          <div>Delivery ID: {lastResult.deliveryId}</div>
          <div>Status: {lastResult.statusCode ?? 'Unknown'}</div>
          {lastResult.errorMessage && (
            <div className="text-rose-300">
              Error: {lastResult.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* E23-S3: Delivery panel */}
      <DevWebhookDeliveryPanel
        endpoint={deliveryPanelEndpoint}
        isOpen={isDeliveryPanelOpen}
        onClose={closeDeliveryPanel}
      />

      {/* Edit/Create modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">
              {editingEndpoint
                ? 'Edit webhook endpoint'
                : 'New webhook endpoint'}
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              ChefCloud will send signed webhook POST requests to this URL.
            </p>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1 text-xs">
                <label className="text-slate-300">Label</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Pourify production"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-slate-300">URL</label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/chefcloud"
                />
              </div>

              {!editingEndpoint && (
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
              )}

              {editingEndpoint && (
                <div className="space-y-1 text-xs">
                  <label className="text-slate-300">Status</label>
                  <div className="inline-flex rounded-full border border-slate-700 p-0.5">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        status === 'ACTIVE'
                          ? 'bg-emerald-500 text-black'
                          : 'text-slate-300'
                      }`}
                      onClick={() => setStatus('ACTIVE')}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        status === 'DISABLED'
                          ? 'bg-slate-200 text-slate-900'
                          : 'text-slate-300'
                      }`}
                      onClick={() => setStatus('DISABLED')}
                    >
                      Disabled
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
                  {formError.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating || isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
                  disabled={
                    isCreating || isUpdating || !label.trim() || !url.trim()
                  }
                >
                  {isCreating || isUpdating ? 'Saving…' : 'Save endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
