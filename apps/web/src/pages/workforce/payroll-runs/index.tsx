/**
 * M10.6: Payroll Runs List Page
 * 
 * Manager/Accountant view of payroll runs with filters and actions.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

type PayrollRunStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';

interface PayrollRun {
  id: string;
  status: PayrollRunStatus;
  regularHours: string;
  overtimeHours: string;
  paidHours: string;
  grossAmount: string | null;
  createdAt: string;
  payPeriod: {
    startDate: string;
    endDate: string;
  };
  branch?: { id: string; name: string } | null;
  createdBy?: { email: string };
  approvedBy?: { email: string };
  _count?: { lines: number };
}

const statusColors: Record<PayrollRunStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CALCULATED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-yellow-100 text-yellow-800',
  POSTED: 'bg-green-100 text-green-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  VOID: 'bg-red-100 text-red-800',
};

export default function PayrollRunsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ['payrollRuns', statusFilter, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (branchFilter) params.set('branchId', branchFilter);
      const res = await apiClient.get(`/workforce/payroll-runs?${params}`);
      return res.data as PayrollRun[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data;
    },
  });

  const { data: payPeriods = [] } = useQuery({
    queryKey: ['payPeriods'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/enterprise/pay-periods');
      return res.data;
    },
  });

  const canCreate = user && ['L4', 'L5'].includes(user.roleLevel);
  const canExport = user && ['L4', 'L5'].includes(user.roleLevel);

  const handleCreateRun = async () => {
    // For now, navigate to a simple create form
    router.push('/workforce/payroll-runs/new');
  };

  const handleRowClick = (runId: string) => {
    router.push(`/workforce/payroll-runs/${runId}`);
  };

  const handleExportSummary = async () => {
    const res = await apiClient.get('/workforce/payroll-runs/reports/export/summary', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'payroll-summary.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Payroll Runs</h1>
            <p className="text-gray-600">Manage payroll runs and GL posting</p>
          </div>
          <div className="flex gap-2">
            {canExport && (
              <button
                onClick={handleExportSummary}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Export Summary
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleCreateRun}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Payroll Run
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CALCULATED">Calculated</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted</option>
            <option value="PAID">Paid</option>
            <option value="VOID">Void</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Branches</option>
            {branches.map((b: { id: string; name: string }) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No payroll runs found. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pay Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Regular Hrs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    OT Hrs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Paid Hrs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => handleRowClick(run.id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {format(new Date(run.payPeriod.startDate), 'MMM d')} -{' '}
                      {format(new Date(run.payPeriod.endDate), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {run.branch?.name ?? 'Org-Wide'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[run.status]}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {run._count?.lines ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {Number(run.regularHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {Number(run.overtimeHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {Number(run.paidHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(run.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
