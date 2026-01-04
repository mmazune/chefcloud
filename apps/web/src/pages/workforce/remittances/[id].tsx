/**
 * M10.9: Remittance Batch Detail Page
 *
 * Shows full batch details with lines and action buttons.
 * Role-based actions: Approve, Post, Pay, Void, Export.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

type RemittanceBatchStatus = 'DRAFT' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';
type RemittanceBatchType = 'TAX' | 'DEDUCTION' | 'EMPLOYER_CONTRIB' | 'MIXED';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface RemittanceLine {
  id: string;
  amount: string;
  payeeName: string | null;
  referenceCode: string | null;
  liabilityAccount: Account;
  counterAccount: Account;
  component?: { id: string; name: string } | null;
}

interface JournalLink {
  id: string;
  type: string;
  journalEntry: {
    id: string;
    description: string;
    status: string;
  };
}

interface RemittanceBatch {
  id: string;
  status: RemittanceBatchStatus;
  type: RemittanceBatchType;
  currencyCode: string;
  totalAmount: string;
  memo: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string } | null;
  period?: { id: string; startDate: string; endDate: string } | null;
  createdBy?: { email: string };
  approvedBy?: { email: string };
  postedBy?: { email: string };
  paidBy?: { email: string };
  voidedBy?: { email: string };
  lines: RemittanceLine[];
  journalLinks: JournalLink[];
}

interface PreviewData {
  batchId: string;
  status: string;
  totalAmount: string;
  currencyCode: string;
  lines: Array<{
    liabilityAccount: { code: string; name: string };
    counterAccount: { code: string; name: string };
    amount: string;
    payeeName: string | null;
  }>;
  journalPreview: {
    description: string;
    totalDebit: string;
    totalCredit: string;
    entries: Array<{
      accountCode: string;
      accountName: string;
      debit: string;
      credit: string;
    }>;
  };
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
  EMPLOYER_CONTRIB: 'Employer Contribution',
  MIXED: 'Mixed',
};

export default function RemittanceBatchDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const orgId = user?.org?.id ?? '';

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Add line form
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({
    liabilityAccountId: '',
    counterAccountId: '',
    amount: '',
    payeeName: '',
    referenceCode: '',
  });

  const { data: batch, isLoading, refetch } = useQuery({
    queryKey: ['remittanceBatch', id],
    queryFn: async () => {
      const res = await apiClient.get(`/orgs/${orgId}/remittances/${id}`);
      return res.data as RemittanceBatch;
    },
    enabled: !!id && !!orgId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', orgId],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/accounts');
      return (res.data.data ?? res.data) as Account[];
    },
    enabled: !!orgId && showAddLine,
  });

  const roleLevel = user?.roleLevel ?? '';
  const isL4Plus = ['L4', 'L5'].includes(roleLevel);
  const isL5 = roleLevel === 'L5';

  const canApprove = isL4Plus && batch?.status === 'DRAFT';
  const canPost = isL5 && batch?.status === 'APPROVED';
  const canPay = isL5 && batch?.status === 'POSTED';
  const canVoid = isL5 && batch?.status !== 'VOID';
  const canPreview = isL4Plus && ['APPROVED', 'POSTED'].includes(batch?.status ?? '');
  const canEdit = batch?.status === 'DRAFT';
  const canExport = isL4Plus;

  const fetchPreview = async () => {
    if (!id || !orgId) return;
    setPreviewLoading(true);
    try {
      const res = await apiClient.get(`/orgs/${orgId}/remittances/${id}/preview`);
      setPreviewData(res.data);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      setError(null);
      setSuccess(null);
      const res = await apiClient.post(`/orgs/${orgId}/remittances/${id}/${action}`);
      return res.data;
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ['remittanceBatch', id] });
      queryClient.invalidateQueries({ queryKey: ['remittanceBatches'] });
      refetch();
      setSuccess(`Successfully ${action}${action.endsWith('e') ? 'd' : 'ed'} batch.`);
    },
    onError: (err: Error) => {
      setError(err.message || 'Action failed');
    },
  });

  const addLineMutation = useMutation({
    mutationFn: async (line: typeof newLine) => {
      const res = await apiClient.post(`/orgs/${orgId}/remittances/${id}/lines`, {
        liabilityAccountId: line.liabilityAccountId,
        counterAccountId: line.counterAccountId,
        amount: line.amount,
        payeeName: line.payeeName || undefined,
        referenceCode: line.referenceCode || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceBatch', id] });
      refetch();
      setShowAddLine(false);
      setNewLine({
        liabilityAccountId: '',
        counterAccountId: '',
        amount: '',
        payeeName: '',
        referenceCode: '',
      });
      setSuccess('Line added successfully');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add line');
    },
  });

  const removeLineMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const res = await apiClient.delete(`/orgs/${orgId}/remittances/${id}/lines/${lineId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittanceBatch', id] });
      refetch();
      setSuccess('Line removed');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to remove line');
    },
  });

  const handleAction = (action: string) => {
    if (confirm(`Are you sure you want to ${action} this batch?`)) {
      actionMutation.mutate(action);
    }
  };

  const handleAddLine = () => {
    if (!newLine.liabilityAccountId || !newLine.counterAccountId || !newLine.amount) {
      setError('Please fill in all required fields');
      return;
    }
    addLineMutation.mutate(newLine);
  };

  const handleRemoveLine = (lineId: string) => {
    if (confirm('Remove this line?')) {
      removeLineMutation.mutate(lineId);
    }
  };

  const handleExport = async () => {
    const res = await apiClient.get(`/orgs/${orgId}/reports/export/remittance-lines?batchId=${id}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `remittance-${id}-lines.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  if (isLoading || !batch) {
    return (
      <AppShell>
        <div className="p-6">Loading...</div>
      </AppShell>
    );
  }

  const liabilityAccounts = accounts.filter((a: any) => a.type === 'LIABILITY');
  const counterAccounts = accounts.filter((a: any) => ['ASSET', 'EXPENSE'].includes(a.type));

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button
              onClick={() => router.push('/workforce/remittances')}
              className="text-blue-600 hover:underline mb-2"
            >
              ← Back to Remittances
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {typeLabels[batch.type]} Remittance
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[batch.status]}`}>
                {batch.status}
              </span>
            </h1>
            <p className="text-gray-600">
              {batch.currencyCode} {formatAmount(batch.totalAmount)}
              {batch.branch && ` · ${batch.branch.name}`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap justify-end">
            {canPreview && (
              <button
                onClick={fetchPreview}
                disabled={previewLoading}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {previewLoading ? 'Loading...' : 'Preview GL'}
              </button>
            )}
            {canApprove && (
              <button
                onClick={() => handleAction('approve')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {canPost && (
              <button
                onClick={() => handleAction('post')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Post
              </button>
            )}
            {canPay && (
              <button
                onClick={() => handleAction('pay')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark Paid
              </button>
            )}
            {canVoid && (
              <button
                onClick={() => handleAction('void')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Void
              </button>
            )}
            {canExport && (
              <button
                onClick={handleExport}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Export Lines
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && previewData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">GL Posting Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-600 mb-4">{previewData.journalPreview.description}</p>
              <table className="min-w-full divide-y divide-gray-200 mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Debit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Credit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.journalPreview.entries.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm">{entry.accountCode} - {entry.accountName}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {parseFloat(entry.debit) > 0 ? formatAmount(entry.debit) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        {parseFloat(entry.credit) > 0 ? formatAmount(entry.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td className="px-4 py-2 text-sm">Total</td>
                    <td className="px-4 py-2 text-sm text-right">{formatAmount(previewData.journalPreview.totalDebit)}</td>
                    <td className="px-4 py-2 text-sm text-right">{formatAmount(previewData.journalPreview.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Details Panel */}
          <div className="col-span-1">
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-4">Batch Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd>{typeLabels[batch.type]}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Currency</dt>
                  <dd>{batch.currencyCode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total</dt>
                  <dd className="font-medium">{formatAmount(batch.totalAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lines</dt>
                  <dd>{batch.lines.length}</dd>
                </div>
                {batch.memo && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Memo</dt>
                    <dd>{batch.memo}</dd>
                  </div>
                )}
                {batch.idempotencyKey && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Key</dt>
                    <dd className="text-xs font-mono">{batch.idempotencyKey}</dd>
                  </div>
                )}
              </dl>
              <hr className="my-4" />
              <h4 className="font-medium mb-2">Audit Trail</h4>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created</dt>
                  <dd>{format(new Date(batch.createdAt), 'MMM d, yyyy HH:mm')}</dd>
                </div>
                {batch.createdBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">By</dt>
                    <dd>{batch.createdBy.email}</dd>
                  </div>
                )}
                {batch.approvedBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Approved by</dt>
                    <dd>{batch.approvedBy.email}</dd>
                  </div>
                )}
                {batch.postedBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Posted by</dt>
                    <dd>{batch.postedBy.email}</dd>
                  </div>
                )}
                {batch.paidBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Paid by</dt>
                    <dd>{batch.paidBy.email}</dd>
                  </div>
                )}
                {batch.voidedBy && (
                  <div className="flex justify-between text-red-600">
                    <dt>Voided by</dt>
                    <dd>{batch.voidedBy.email}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Journal Links */}
            {batch.journalLinks.length > 0 && (
              <div className="bg-white rounded shadow p-4 mt-4">
                <h3 className="font-semibold mb-4">Linked Journals</h3>
                <ul className="space-y-2 text-sm">
                  {batch.journalLinks.map((link) => (
                    <li key={link.id} className="flex justify-between items-center">
                      <span className="text-gray-600">{link.type}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {link.journalEntry.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lines Panel */}
          <div className="col-span-2">
            <div className="bg-white rounded shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Remittance Lines</h3>
                {canEdit && (
                  <button
                    onClick={() => setShowAddLine(!showAddLine)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {showAddLine ? 'Cancel' : '+ Add Line'}
                  </button>
                )}
              </div>

              {/* Add Line Form */}
              {showAddLine && (
                <div className="border rounded p-4 mb-4 bg-gray-50">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Liability Account *
                      </label>
                      <select
                        value={newLine.liabilityAccountId}
                        onChange={(e) => setNewLine({ ...newLine, liabilityAccountId: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {liabilityAccounts.map((a: Account) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Counter Account *
                      </label>
                      <select
                        value={newLine.counterAccountId}
                        onChange={(e) => setNewLine({ ...newLine, counterAccountId: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {counterAccounts.map((a: Account) => (
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
                        value={newLine.amount}
                        onChange={(e) => setNewLine({ ...newLine, amount: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payee Name
                      </label>
                      <input
                        type="text"
                        value={newLine.payeeName}
                        onChange={(e) => setNewLine({ ...newLine, payeeName: e.target.value })}
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
                        value={newLine.referenceCode}
                        onChange={(e) => setNewLine({ ...newLine, referenceCode: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="e.g., TIN-1234567"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleAddLine}
                        disabled={addLineMutation.isPending}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {addLineMutation.isPending ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lines Table */}
              {batch.lines.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No lines in this batch. {canEdit && 'Add lines to continue.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Liability Account
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Counter Account
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Payee
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Ref
                        </th>
                        {canEdit && (
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {batch.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2 text-sm">
                            {line.liabilityAccount.code} - {line.liabilityAccount.name}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {line.counterAccount.code} - {line.counterAccount.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium">
                            {formatAmount(line.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {line.payeeName ?? '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {line.referenceCode ?? '-'}
                          </td>
                          {canEdit && (
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleRemoveLine(line.id)}
                                disabled={removeLineMutation.isPending}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-sm">Total</td>
                        <td className="px-4 py-2 text-sm text-right">{formatAmount(batch.totalAmount)}</td>
                        <td colSpan={canEdit ? 3 : 2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
