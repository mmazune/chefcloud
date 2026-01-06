/**
 * M10.10: Component Remittance Mappings Page
 *
 * Map compensation components to remittance providers.
 * RBAC: L4+ for CRUD.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

type RemittanceType = 'TAX' | 'DEDUCTION' | 'EMPLOYER_CONTRIB' | 'MIXED';
type ComponentType = 'EARNING' | 'DEDUCTION_PRE' | 'DEDUCTION_POST' | 'TAX' | 'EMPLOYER_CONTRIB';

interface CompensationRemittanceMapping {
  id: string;
  componentId: string;
  providerId: string;
  remittanceType: RemittanceType;
  component: {
    id: string;
    code: string;
    name: string;
    type: ComponentType;
  };
  provider: {
    id: string;
    name: string;
    type: string;
  };
}

interface CompensationComponent {
  id: string;
  code: string;
  name: string;
  type: ComponentType;
  enabled: boolean;
}

interface RemittanceProvider {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

const remittanceTypeLabels: Record<RemittanceType, string> = {
  TAX: 'Tax',
  DEDUCTION: 'Deduction',
  EMPLOYER_CONTRIB: 'Employer Contribution',
  MIXED: 'Mixed',
};

const componentTypeColors: Record<ComponentType, string> = {
  EARNING: 'bg-green-100 text-green-800',
  DEDUCTION_PRE: 'bg-orange-100 text-orange-800',
  DEDUCTION_POST: 'bg-yellow-100 text-yellow-800',
  TAX: 'bg-red-100 text-red-800',
  EMPLOYER_CONTRIB: 'bg-purple-100 text-purple-800',
};

export default function RemittanceMappingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    componentId: '',
    providerId: '',
    remittanceType: 'TAX' as RemittanceType,
  });

  const orgId = user?.org?.id ?? '';

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['remittanceMappings', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/remittance-mappings`);
      return res.data as CompensationRemittanceMapping[];
    },
    enabled: !!orgId,
  });

  const { data: components = [] } = useQuery({
    queryKey: ['compensationComponents', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/compensation/components`);
      return res.data as CompensationComponent[];
    },
    enabled: !!orgId,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['remittanceProviders', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/remittance-providers`);
      return res.data as RemittanceProvider[];
    },
    enabled: !!orgId,
  });

  // Filter to components that can be remitted (not earnings)
  const remittableComponents = components.filter(c =>
    ['DEDUCTION_PRE', 'DEDUCTION_POST', 'TAX', 'EMPLOYER_CONTRIB'].includes(c.type) && c.enabled
  );

  // Find already mapped component IDs
  const mappedComponentIds = new Set(mappings.map(m => m.componentId));

  // Available components for new mappings
  const availableComponents = remittableComponents.filter(c => !mappedComponentIds.has(c.id));

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiClient.post(`/orgs/${orgId}/remittance-mappings`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceMappings'] });
      toast({ title: 'Mapping created', variant: 'default' });
      handleCloseModal();
    },
    onError: () => {
      toast({ title: 'Failed to create mapping', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/orgs/${orgId}/remittance-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceMappings'] });
      toast({ title: 'Mapping deleted', variant: 'default' });
    },
    onError: () => {
      toast({ title: 'Failed to delete mapping', variant: 'destructive' });
    },
  });

  const handleOpenModal = () => {
    setForm({ componentId: '', providerId: '', remittanceType: 'TAX' });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.componentId || !form.providerId) {
      toast({ title: 'Please select both component and provider', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this mapping?')) {
      deleteMutation.mutate(id);
    }
  };

  const roleLevel = user?.roleLevel ?? '';
  const canManage = ['L4', 'L5'].includes(roleLevel);

  // Suggest remittance type based on component type
  const suggestRemittanceType = (componentId: string): RemittanceType => {
    const component = components.find(c => c.id === componentId);
    if (!component) return 'MIXED';
    switch (component.type) {
      case 'TAX': return 'TAX';
      case 'DEDUCTION_PRE':
      case 'DEDUCTION_POST': return 'DEDUCTION';
      case 'EMPLOYER_CONTRIB': return 'EMPLOYER_CONTRIB';
      default: return 'MIXED';
    }
  };

  const handleComponentChange = (componentId: string) => {
    setForm({
      ...form,
      componentId,
      remittanceType: suggestRemittanceType(componentId),
    });
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Component Mappings</h1>
            <p className="text-gray-600">Map compensation components to remittance providers</p>
          </div>
          {canManage && availableComponents.length > 0 && (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Mapping
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Mappings</div>
            <div className="text-2xl font-bold">{mappings.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unmapped Components</div>
            <div className="text-2xl font-bold">{availableComponents.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active Providers</div>
            <div className="text-2xl font-bold">{providers.filter(p => p.enabled).length}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No mappings configured. Map components to providers for automated remittance generation.
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remittance Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{mapping.component.code}</div>
                      <div className="text-sm text-gray-500">{mapping.component.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${componentTypeColors[mapping.component.type]}`}>
                        {mapping.component.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.provider.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded bg-gray-100">
                        {remittanceTypeLabels[mapping.remittanceType]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {canManage && (
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unmapped Components Warning */}
        {availableComponents.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-medium text-yellow-800">Unmapped Components</h3>
            <p className="text-sm text-yellow-700 mt-1">
              The following components are not mapped to any provider:
            </p>
            <ul className="mt-2 text-sm text-yellow-700">
              {availableComponents.map(c => (
                <li key={c.id}>• {c.code} - {c.name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4">Add Component Mapping</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Component *</label>
                  <select
                    value={form.componentId}
                    onChange={(e) => handleComponentChange(e.target.value)}
                    required
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    <option value="">-- Select Component --</option>
                    {availableComponents.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.code} - {comp.name} ({comp.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Provider *</label>
                  <select
                    value={form.providerId}
                    onChange={(e) => setForm({ ...form, providerId: e.target.value })}
                    required
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    <option value="">-- Select Provider --</option>
                    {providers.filter(p => p.enabled).map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} ({provider.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Remittance Type *</label>
                  <select
                    value={form.remittanceType}
                    onChange={(e) => setForm({ ...form, remittanceType: e.target.value as RemittanceType })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  >
                    {Object.entries(remittanceTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
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
                    disabled={createMutation.isPending}
                  >
                    Create Mapping
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
