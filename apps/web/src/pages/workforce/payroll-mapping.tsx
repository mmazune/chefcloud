/**
 * M10.8: Payroll Posting Mapping Page
 * 
 * Allows configuration of GL account mappings for payroll posting.
 * L4+ can view and edit mappings.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface AccountRef {
  id: string;
  code: string;
  name: string;
}

interface PayrollMapping {
  id: string;
  branchId: string | null;
  enabled: boolean;
  laborExpenseAccount: AccountRef;
  wagesPayableAccount: AccountRef;
  taxesPayableAccount: AccountRef;
  deductionsPayableAccount: AccountRef;
  employerContribExpenseAccount: AccountRef;
  employerContribPayableAccount: AccountRef;
  cashAccount: AccountRef;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  name: string;
}

const ACCOUNT_FIELD_LABELS = {
  laborExpenseAccountId: 'Labor Expense Account',
  wagesPayableAccountId: 'Wages Payable Account',
  taxesPayableAccountId: 'Taxes Payable Account',
  deductionsPayableAccountId: 'Deductions Payable Account',
  employerContribExpenseAccountId: 'Employer Contrib Expense',
  employerContribPayableAccountId: 'Employer Contrib Payable',
  cashAccountId: 'Cash/Bank Account',
} as const;

const ACCOUNT_TYPE_HINTS: Record<string, string> = {
  laborExpenseAccountId: 'EXPENSE',
  wagesPayableAccountId: 'LIABILITY',
  taxesPayableAccountId: 'LIABILITY',
  deductionsPayableAccountId: 'LIABILITY',
  employerContribExpenseAccountId: 'EXPENSE',
  employerContribPayableAccountId: 'LIABILITY',
  cashAccountId: 'ASSET',
};

export default function PayrollMappingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const orgId = user?.org?.id ?? '';

  // Fetch all mappings
  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['payrollMappings', orgId],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/payroll-mapping/list`);
      return res.data.data as PayrollMapping[];
    },
    enabled: !!orgId,
  });

  // Fetch accounts
  const { data: accountsData } = useQuery({
    queryKey: ['accounts', orgId],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/accounts');
      return res.data.data ?? res.data as Account[];
    },
    enabled: !!orgId,
  });

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches', orgId],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data.data ?? res.data as Branch[];
    },
    enabled: !!orgId,
  });

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiClient.put(`/orgs/${orgId}/payroll-mapping`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollMappings', orgId] });
      setSuccess('Mapping saved successfully');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to save mapping');
      setSuccess(null);
    },
  });

  // Initialize default mutation
  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/orgs/${orgId}/payroll-mapping/initialize`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payrollMappings', orgId] });
      setSuccess(data.message ?? 'Default mapping initialized');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to initialize');
      setSuccess(null);
    },
  });

  // Get selected mapping
  const selectedMapping = mappingsData?.find((m) =>
    selectedBranchId === null ? m.branchId === null : m.branchId === selectedBranchId,
  );

  // Initialize form when mapping changes
  const initForm = (mapping?: PayrollMapping) => {
    if (mapping) {
      setFormData({
        laborExpenseAccountId: mapping.laborExpenseAccount.id,
        wagesPayableAccountId: mapping.wagesPayableAccount.id,
        taxesPayableAccountId: mapping.taxesPayableAccount.id,
        deductionsPayableAccountId: mapping.deductionsPayableAccount.id,
        employerContribExpenseAccountId: mapping.employerContribExpenseAccount.id,
        employerContribPayableAccountId: mapping.employerContribPayableAccount.id,
        cashAccountId: mapping.cashAccount.id,
      });
    } else {
      setFormData({});
    }
  };

  const handleSave = () => {
    const requiredFields = Object.keys(ACCOUNT_FIELD_LABELS);
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please select a ${ACCOUNT_FIELD_LABELS[field as keyof typeof ACCOUNT_FIELD_LABELS]}`);
        return;
      }
    }

    upsertMutation.mutate({
      branchId: selectedBranchId,
      ...formData,
    });
  };

  const roleLevel = user?.roleLevel ?? '';
  const canEdit = ['L4', 'L5'].includes(roleLevel);

  const filteredAccounts = (fieldKey: string): Account[] => {
    const hint = ACCOUNT_TYPE_HINTS[fieldKey];
    if (!accountsData) return [];
    if (!hint) return accountsData;
    return accountsData.filter((a: Account) => a.type === hint);
  };

  if (mappingsLoading) {
    return (
      <AppShell>
        <div className="p-6">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Payroll Posting Mapping</h1>
        <p className="text-gray-600 mb-6">
          Configure GL account mappings for payroll journal entries. Set org-wide defaults
          or create branch-specific overrides.
        </p>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded text-green-700">
            {success}
          </div>
        )}

        {/* Branch/Org Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configure Mapping For:
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setSelectedBranchId(null);
                initForm(mappingsData?.find((m) => m.branchId === null));
              }}
              className={`px-4 py-2 rounded border ${
                selectedBranchId === null
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              Organization Default
            </button>
            {branchesData?.map((branch: Branch) => (
              <button
                key={branch.id}
                onClick={() => {
                  setSelectedBranchId(branch.id);
                  initForm(mappingsData?.find((m) => m.branchId === branch.id));
                }}
                className={`px-4 py-2 rounded border ${
                  selectedBranchId === branch.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mapping Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-500">Current Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                selectedMapping ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {selectedMapping ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            {!selectedMapping && selectedBranchId === null && canEdit && (
              <button
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Initialize Default
              </button>
            )}
          </div>
        </div>

        {/* Account Selection Form */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Account Mappings</h2>
          <div className="space-y-4">
            {Object.entries(ACCOUNT_FIELD_LABELS).map(([fieldKey, label]) => (
              <div key={fieldKey}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label}
                  <span className="text-xs text-gray-500 ml-2">
                    ({ACCOUNT_TYPE_HINTS[fieldKey]})
                  </span>
                </label>
                <select
                  value={formData[fieldKey] || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                  }
                  disabled={!canEdit}
                  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
                >
                  <option value="">Select account...</option>
                  {filteredAccounts(fieldKey).map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.code} - {acct.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={upsertMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {upsertMutation.isPending ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        )}

        {/* Existing Mappings List */}
        {mappingsData && mappingsData.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">All Configured Mappings</h2>
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Scope
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Labor Expense
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Wages Payable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Taxes Payable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappingsData.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {mapping.branchId
                          ? branchesData?.find((b: Branch) => b.id === mapping.branchId)?.name ?? 'Branch'
                          : 'Organization'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {mapping.laborExpenseAccount.code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {mapping.wagesPayableAccount.code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {mapping.taxesPayableAccount.code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          mapping.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mapping.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
