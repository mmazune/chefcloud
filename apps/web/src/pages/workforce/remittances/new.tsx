/**
 * M10.9: New Remittance Batch Page
 *
 * Form to create a new remittance batch with lines.
 * RBAC: L4+ can create.
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

type RemittanceBatchType = 'TAX' | 'DEDUCTION' | 'EMPLOYER_CONTRIB' | 'MIXED';

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

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

interface LineEntry {
  key: number;
  componentId?: string;
  liabilityAccountId: string;
  counterAccountId: string;
  amount: string;
  payeeName: string;
  referenceCode: string;
}

const typeOptions: { value: RemittanceBatchType; label: string }[] = [
  { value: 'TAX', label: 'Tax' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER_CONTRIB', label: 'Employer Contribution' },
  { value: 'MIXED', label: 'Mixed' },
];

let lineKeyCounter = 0;

export default function NewRemittancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const orgId = user?.org?.id ?? '';

  const [formData, setFormData] = useState({
    branchId: '',
    type: 'TAX' as RemittanceBatchType,
    currencyCode: 'UGX',
    periodId: '',
    idempotencyKey: '',
    memo: '',
  });

  const [lines, setLines] = useState<LineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'header' | 'lines'>('header');
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data as Branch[];
    },
    enabled: !!orgId,
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', orgId],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/accounts');
      return (res.data.data ?? res.data) as Account[];
    },
    enabled: !!orgId,
  });

  // Fetch pay periods
  const { data: payPeriods = [] } = useQuery({
    queryKey: ['payPeriods'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/enterprise/pay-periods');
      return res.data as PayPeriod[];
    },
    enabled: !!orgId,
  });

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiClient.post(`/orgs/${orgId}/remittances`, {
        branchId: data.branchId || undefined,
        type: data.type,
        currencyCode: data.currencyCode,
        periodId: data.periodId || undefined,
        idempotencyKey: data.idempotencyKey || undefined,
        memo: data.memo || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCreatedBatchId(data.id);
      setStep('lines');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create batch');
    },
  });

  // Add line mutation
  const addLineMutation = useMutation({
    mutationFn: async (line: Omit<LineEntry, 'key'>) => {
      const res = await apiClient.post(`/orgs/${orgId}/remittances/${createdBatchId}/lines`, {
        componentId: line.componentId || undefined,
        liabilityAccountId: line.liabilityAccountId,
        counterAccountId: line.counterAccountId,
        amount: line.amount,
        payeeName: line.payeeName || undefined,
        referenceCode: line.referenceCode || undefined,
      });
      return res.data;
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add line');
    },
  });

  const handleCreateBatch = () => {
    if (!formData.type) {
      setError('Please select a batch type');
      return;
    }
    createBatchMutation.mutate(formData);
  };

  const addNewLine = () => {
    setLines([
      ...lines,
      {
        key: ++lineKeyCounter,
        liabilityAccountId: '',
        counterAccountId: '',
        amount: '',
        payeeName: '',
        referenceCode: '',
      },
    ]);
  };

  const updateLine = (key: number, field: keyof LineEntry, value: string) => {
    setLines(lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const removeLine = (key: number) => {
    setLines(lines.filter((l) => l.key !== key));
  };

  const handleSaveLines = async () => {
    setError(null);
    for (const line of lines) {
      if (!line.liabilityAccountId || !line.counterAccountId || !line.amount) {
        setError('Please fill in all required fields for each line');
        return;
      }
      await addLineMutation.mutateAsync(line);
    }
    // Navigate to detail page
    router.push(`/workforce/remittances/${createdBatchId}`);
  };

  const handleSkipLines = () => {
    router.push(`/workforce/remittances/${createdBatchId}`);
  };

  const liabilityAccounts = accounts.filter((a) => a.type === 'LIABILITY');
  const counterAccounts = accounts.filter((a) => ['ASSET', 'EXPENSE'].includes(a.type));

  const formatPeriod = (period: PayPeriod) => {
    const start = new Date(period.startDate).toLocaleDateString();
    const end = new Date(period.endDate).toLocaleDateString();
    return `${start} - ${end}`;
  };

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/workforce/remittances')}
          className="text-blue-600 hover:underline mb-4"
        >
          ← Back to Remittances
        </button>

        <h1 className="text-2xl font-bold mb-6">New Remittance Batch</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {step === 'header' && (
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Batch Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as RemittanceBatchType })}
                  className="w-full border rounded px-3 py-2"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch (optional)
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Org-Wide</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <input
                  type="text"
                  value={formData.currencyCode}
                  onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Period (optional)
                </label>
                <select
                  value={formData.periodId}
                  onChange={(e) => setFormData({ ...formData, periodId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select...</option>
                  {payPeriods.map((p) => (
                    <option key={p.id} value={p.id}>{formatPeriod(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idempotency Key (optional)
                </label>
                <input
                  type="text"
                  value={formData.idempotencyKey}
                  onChange={(e) => setFormData({ ...formData, idempotencyKey: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., TAX-2024-01"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Memo (optional)
                </label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => router.push('/workforce/remittances')}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                disabled={createBatchMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createBatchMutation.isPending ? 'Creating...' : 'Create Batch'}
              </button>
            </div>
          </div>
        )}

        {step === 'lines' && (
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Add Remittance Lines</h2>
            <p className="text-gray-600 mb-4">
              Add liability settlements. You can also skip this step and add lines later.
            </p>

            {lines.length > 0 && (
              <div className="space-y-4 mb-4">
                {lines.map((line) => (
                  <div key={line.key} className="border rounded p-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Liability Account *
                        </label>
                        <select
                          value={line.liabilityAccountId}
                          onChange={(e) => updateLine(line.key, 'liabilityAccountId', e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                        >
                          <option value="">Select...</option>
                          {liabilityAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Counter Account *
                        </label>
                        <select
                          value={line.counterAccountId}
                          onChange={(e) => updateLine(line.key, 'counterAccountId', e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                        >
                          <option value="">Select...</option>
                          {counterAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.amount}
                          onChange={(e) => updateLine(line.key, 'amount', e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Payee Name
                        </label>
                        <input
                          type="text"
                          value={line.payeeName}
                          onChange={(e) => updateLine(line.key, 'payeeName', e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="e.g., URA"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reference Code
                        </label>
                        <input
                          type="text"
                          value={line.referenceCode}
                          onChange={(e) => updateLine(line.key, 'referenceCode', e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="e.g., TIN-1234567"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeLine(line.key)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={addNewLine}
              className="px-4 py-2 border border-dashed rounded hover:bg-gray-50 text-gray-600"
            >
              + Add Line
            </button>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleSkipLines}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Skip & Finish
              </button>
              {lines.length > 0 && (
                <button
                  onClick={handleSaveLines}
                  disabled={addLineMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addLineMutation.isPending ? 'Saving...' : 'Save Lines & Finish'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
