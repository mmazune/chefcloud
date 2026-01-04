/**
 * M10.6: Create New Payroll Run Page
 * 
 * Form to create a new payroll run with pay period selection.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  locked: boolean;
}

interface Branch {
  id: string;
  name: string;
}

export default function CreatePayrollRunPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [payPeriodId, setPayPeriodId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: payPeriods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ['payPeriods'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/enterprise/pay-periods');
      return res.data as PayPeriod[];
    },
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data as Branch[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: { payPeriodId: string; branchId?: string } = { payPeriodId };
      if (branchId) body.branchId = branchId;
      const res = await apiClient.post('/workforce/payroll-runs', body);
      return res.data;
    },
    onSuccess: (data) => {
      router.push(`/workforce/payroll-runs/${data.id}`);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      setError(err.response?.data?.message ?? err.message ?? 'Failed to create payroll run');
    },
  });

  const roleLevel = user?.roleLevel ?? '';
  const canCreate = ['L4', 'L5'].includes(roleLevel);

  if (!canCreate) {
    return (
      <AppShell>
        <div className="p-6">
          <div className="text-red-600">You do not have permission to create payroll runs.</div>
        </div>
      </AppShell>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!payPeriodId) {
      setError('Please select a pay period.');
      return;
    }
    const selectedPeriod = payPeriods.find((p) => p.id === payPeriodId);
    if (selectedPeriod?.locked) {
      setError('Cannot create payroll run for a locked pay period.');
      return;
    }
    createMutation.mutate();
  };

  const unlockedPeriods = payPeriods.filter((p) => !p.locked);

  return (
    <AppShell>
      <div className="p-6 max-w-xl">
        <button
          onClick={() => router.push('/workforce/payroll-runs')}
          className="text-blue-600 hover:underline mb-4"
        >
          ← Back to Payroll Runs
        </button>

        <h1 className="text-2xl font-bold mb-6">Create Payroll Run</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pay Period <span className="text-red-500">*</span>
            </label>
            {loadingPeriods ? (
              <div className="text-gray-500">Loading pay periods...</div>
            ) : unlockedPeriods.length === 0 ? (
              <div className="text-yellow-600">
                No unlocked pay periods available. All periods are locked.
              </div>
            ) : (
              <select
                value={payPeriodId}
                onChange={(e) => setPayPeriodId(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">Select a pay period...</option>
                {unlockedPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {format(new Date(period.startDate), 'MMM d')} -{' '}
                    {format(new Date(period.endDate), 'MMM d, yyyy')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch (Optional)
            </label>
            {loadingBranches ? (
              <div className="text-gray-500">Loading branches...</div>
            ) : (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Org-Wide (All Branches)</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Leave blank to include all employees across all branches.
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || !payPeriodId}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Payroll Run'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h3 className="font-medium mb-2">What happens next?</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>A new payroll run will be created in <strong>DRAFT</strong> status.</li>
            <li>Click <strong>Calculate</strong> to compute hours from approved time entries.</li>
            <li>Review line items and click <strong>Approve</strong> when ready.</li>
            <li>Click <strong>Post to GL</strong> to create accounting entries.</li>
            <li>Click <strong>Mark Paid</strong> after payroll is disbursed.</li>
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
