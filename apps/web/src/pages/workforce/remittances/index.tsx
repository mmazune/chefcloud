/**
 * M10.9: Remittance Batches List Page
 *
 * Manager/Accountant view of remittance batches with filters and actions.
 * RBAC: L4+ can view; L5 can post/pay/void.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

type RemittanceBatchStatus = 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';
type RemittanceBatchType = 'TAX' | 'DEDUCTION' | 'EMPLOYER_CONTRIB' | 'MIXED';

interface RemittanceBatch {
  id: string;
  status: RemittanceBatchStatus;
  type: RemittanceBatchType;
  currencyCode: string;
  totalAmount: string;
  memo: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  createdBy?: { email: string };
  approvedBy?: { email: string };
  _count?: { lines: number };
}

interface Branch {
  id: string;
  name: string;
}

const statusColors: Record<RemittanceBatchStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-yellow-100 text-yellow-800',
  POSTED: 'bg-green-100 text-green-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  VOID: 'bg-red-100 text-red-800',
};

const typeLabels: Record<RemittanceBatchType, string> = {
  TAX: 'Tax',
  DEDUCTION: 'Deduction',
  EMPLOYER_CONTRIB: 'Employer Contrib',
  MIXED: 'Mixed',
};

export default function RemittancesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');

  const orgId = user?.org?.id ?? '';

  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['remittanceBatches', orgId, statusFilter, typeFilter, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (branchFilter) params.set('branchId', branchFilter);
      const res = await apiClient.get(`/orgs/${orgId}/remittances?${params}`);
      return res.data as RemittanceBatch[];
    },
    enabled: !!orgId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data as Branch[];
    },
    enabled: !!orgId,
  });

  const { data: kpis } = useQuery({
    queryKey: ['remittanceKpis', orgId, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.set('branchId', branchFilter);
      const res = await apiClient.get(`/orgs/${orgId}/reports/remittances/kpis?${params}`);
      return res.data;
    },
    enabled: !!orgId,
  });

  const roleLevel = user?.roleLevel ?? '';
  const canCreate = ['L4', 'L5'].includes(roleLevel);
  const canExport = ['L4', 'L5'].includes(roleLevel);

  const handleCreateBatch = () => {
    router.push('/workforce/remittances/new');
  };

  const handleRowClick = (batchId: string) => {
    router.push(`/workforce/remittances/${batchId}`);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (branchFilter) params.set('branchId', branchFilter);

    const res = await apiClient.get(`/orgs/${orgId}/reports/export/remittances?${params}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'remittances.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Liability Remittances</h1>
            <p className="text-gray-600">Manage tax, deduction, and employer contribution payments</p>
          </div>
          <div className="flex gap-2">
            {canExport && (
              <button
                onClick={handleExport}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Export CSV
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleCreateBatch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                New Remittance
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-gray-500">Total Batches</div>
              <div className="text-2xl font-bold">{kpis.totalBatches}</div>
            </div>
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-gray-500">Pending Approval</div>
              <div className="text-2xl font-bold text-yellow-600">{kpis.pendingApproval}</div>
            </div>
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-gray-500">Pending Payment</div>
              <div className="text-2xl font-bold text-green-600">{kpis.pendingPayment}</div>
            </div>
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-gray-500">Total Amount (PAID)</div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatAmount(kpis.totalPaidAmount)}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted</option>
            <option value="PAID">Paid</option>
            <option value="VOID">Void</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Types</option>
            <option value="TAX">Tax</option>
            <option value="DEDUCTION">Deduction</option>
            <option value="EMPLOYER_CONTRIB">Employer Contrib</option>
            <option value="MIXED">Mixed</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
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
        ) : batches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No remittance batches found. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Lines
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Memo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr
                    key={batch.id}
                    onClick={() => handleRowClick(batch.id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {typeLabels[batch.type]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {batch.branch?.name ?? 'Org-Wide'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[batch.status]}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {batch._count?.lines ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {batch.currencyCode} {formatAmount(batch.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {batch.memo ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(batch.createdAt), 'MMM d, yyyy')}
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
