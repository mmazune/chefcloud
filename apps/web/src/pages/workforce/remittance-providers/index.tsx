/**
 * M10.10: Remittance Providers List Page
 *
 * Manage remittance providers (TAX_AUTHORITY, BENEFITS, PENSION, OTHER).
 * RBAC: L4+ for CRUD.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

type RemittanceProviderType = 'TAX_AUTHORITY' | 'BENEFITS' | 'PENSION' | 'OTHER';

interface RemittanceProvider {
  id: string;
  name: string;
  type: RemittanceProviderType;
  referenceFormatHint: string | null;
  enabled: boolean;
  defaultLiabilityAccount?: { id: string; code: string; name: string } | null;
  defaultCashAccount?: { id: string; code: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  _count?: { componentMappings: number };
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

const typeLabels: Record<RemittanceProviderType, string> = {
  TAX_AUTHORITY: 'Tax Authority',
  BENEFITS: 'Benefits',
  PENSION: 'Pension Fund',
  OTHER: 'Other',
};

const typeColors: Record<RemittanceProviderType, string> = {
  TAX_AUTHORITY: 'bg-red-100 text-red-800',
  BENEFITS: 'bg-blue-100 text-blue-800',
  PENSION: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function RemittanceProvidersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<RemittanceProvider | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'TAX_AUTHORITY' as RemittanceProviderType,
    referenceFormatHint: '',
    defaultLiabilityAccountId: '',
    defaultCashAccountId: '',
    enabled: true,
  });

  const orgId = user?.org?.id ?? '';

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['remittanceProviders', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/remittance-providers`);
      return res.data as RemittanceProvider[];
    },
    enabled: !!orgId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/accounts`);
      return res.data as Account[];
    },
    enabled: !!orgId,
  });

  const liabilityAccounts = accounts.filter(a => a.type === 'LIABILITY');
  const assetAccounts = accounts.filter(a => a.type === 'ASSET');

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiClient.post(`/orgs/${orgId}/remittance-providers`, {
        ...data,
        defaultLiabilityAccountId: data.defaultLiabilityAccountId || null,
        defaultCashAccountId: data.defaultCashAccountId || null,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceProviders'] });
      toast({ title: 'Provider created', variant: 'default' });
      handleCloseModal();
    },
    onError: () => {
      toast({ title: 'Failed to create provider', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof form> }) => {
      const res = await apiClient.patch(`/orgs/${orgId}/remittance-providers/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceProviders'] });
      toast({ title: 'Provider updated', variant: 'default' });
      handleCloseModal();
    },
    onError: () => {
      toast({ title: 'Failed to update provider', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/orgs/${orgId}/remittance-providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceProviders'] });
      toast({ title: 'Provider deleted', variant: 'default' });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Failed to delete provider';
      toast({ title: message, variant: 'destructive' });
    },
  });

  const handleOpenCreateModal = () => {
    setEditingProvider(null);
    setForm({
      name: '',
      type: 'TAX_AUTHORITY',
      referenceFormatHint: '',
      defaultLiabilityAccountId: '',
      defaultCashAccountId: '',
      enabled: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (provider: RemittanceProvider) => {
    setEditingProvider(provider);
    setForm({
      name: provider.name,
      type: provider.type,
      referenceFormatHint: provider.referenceFormatHint ?? '',
      defaultLiabilityAccountId: provider.defaultLiabilityAccount?.id ?? '',
      defaultCashAccountId: provider.defaultCashAccount?.id ?? '',
      enabled: provider.enabled,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProvider(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this provider?')) {
      deleteMutation.mutate(id);
    }
  };

  const roleLevel = user?.roleLevel ?? '';
  const canManage = ['L4', 'L5'].includes(roleLevel);

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Remittance Providers</h1>
            <p className="text-gray-600">Manage payees for liability remittances</p>
          </div>
          {canManage && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Provider
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No providers configured. Add a provider to get started.
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference Format</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Liability</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mappings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{provider.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${typeColors[provider.type]}`}>
                        {typeLabels[provider.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {provider.referenceFormatHint || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {provider.defaultLiabilityAccount
                        ? `${provider.defaultLiabilityAccount.code} - ${provider.defaultLiabilityAccount.name}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {provider._count?.componentMappings ?? 0} components
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded ${provider.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {provider.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(provider)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(provider.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingProvider ? 'Edit Provider' : 'Add Provider'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="mt-1 block w-full border rounded px-3 py-2"
                    placeholder="e.g., Uganda Revenue Authority"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as RemittanceProviderType })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Reference Format Hint</label>
                  <input
                    type="text"
                    value={form.referenceFormatHint}
                    onChange={(e) => setForm({ ...form, referenceFormatHint: e.target.value })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                    placeholder="e.g., TIN-XXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Liability Account</label>
                  <select
                    value={form.defaultLiabilityAccountId}
                    onChange={(e) => setForm({ ...form, defaultLiabilityAccountId: e.target.value })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    <option value="">-- Select --</option>
                    {liabilityAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Cash Account</label>
                  <select
                    value={form.defaultCashAccountId}
                    onChange={(e) => setForm({ ...form, defaultCashAccountId: e.target.value })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    <option value="">-- Select --</option>
                    {assetAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Enabled</label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingProvider ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
