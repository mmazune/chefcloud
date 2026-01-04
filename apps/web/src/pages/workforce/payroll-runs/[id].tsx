/**
 * M10.6: Payroll Run Detail Page
 * 
 * Shows full run details with line items and action buttons.
 * Role-based actions: Calculate, Approve, Post, Pay, Void, Export.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';

type PayrollRunStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';

interface PayrollRunLine {
  id: string;
  regularHours: string;
  overtimeHours: string;
  breakHours: string;
  paidHours: string;
  hourlyRate: string | null;
  grossAmount: string | null;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface JournalLink {
  id: string;
  type: 'ACCRUAL' | 'PAYMENT';
  journalEntry: {
    id: string;
    description: string;
    status: string;
  };
}

interface PayrollRun {
  id: string;
  status: PayrollRunStatus;
  regularHours: string;
  overtimeHours: string;
  breakHours: string;
  paidHours: string;
  grossAmount: string | null;
  createdAt: string;
  updatedAt: string;
  payPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    locked: boolean;
  };
  branch?: { id: string; name: string } | null;
  createdBy?: { email: string };
  approvedBy?: { email: string };
  postedBy?: { email: string };
  paidBy?: { email: string };
  voidedBy?: { email: string };
  lines: PayrollRunLine[];
  journalLinks: JournalLink[];
}

const statusColors: Record<PayrollRunStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CALCULATED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-yellow-100 text-yellow-800',
  POSTED: 'bg-green-100 text-green-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  VOID: 'bg-red-100 text-red-800',
};

export default function PayrollRunDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: run, isLoading, refetch } = useQuery({
    queryKey: ['payrollRun', id],
    queryFn: async () => {
      const res = await apiClient.get(`/workforce/payroll-runs/${id}`);
      return res.data as PayrollRun;
    },
    enabled: !!id,
  });

  const roleLevel = user?.roleLevel ?? '';
  const isL4Plus = ['L4', 'L5'].includes(roleLevel);
  const isL5 = roleLevel === 'L5';
  const canCalculate = isL4Plus && run?.status === 'DRAFT';
  const canApprove = isL4Plus && run?.status === 'CALCULATED';
  const canPost = isL5 && run?.status === 'APPROVED';
  const canPreview = isL4Plus && (run?.status === 'APPROVED' || run?.status === 'POSTED');
  const canPay = isL5 && run?.status === 'POSTED';
  const canVoid = isL5 && (run?.status === 'POSTED' || run?.status === 'PAID');
  const canExport = isL4Plus && run?.status !== 'DRAFT';

  // M10.8: Posting preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchPreview = async () => {
    if (!id) return;
    setPreviewLoading(true);
    try {
      const res = await apiClient.get(`/workforce/payroll-runs/${id}/posting-preview`);
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
      const res = await apiClient.post(`/workforce/payroll-runs/${id}/${action}`);
      return res.data;
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ['payrollRun', id] });
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      refetch();
      setSuccess(`Successfully ${action}ed payroll run.`);
    },
    onError: (err: Error) => {
      setError(err.message || 'Action failed');
    },
  });

  const handleAction = (action: string) => {
    if (confirm(`Are you sure you want to ${action} this payroll run?`)) {
      actionMutation.mutate(action);
    }
  };

  const handleExport = async () => {
    const res = await apiClient.get(`/workforce/payroll-runs/${id}/export`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll-run-${id}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (isLoading || !run) {
    return (
      <AppShell>
        <div className="p-6">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button
              onClick={() => router.push('/workforce/payroll-runs')}
              className="text-blue-600 hover:underline mb-2"
            >
              ← Back to Payroll Runs
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Payroll Run
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[run.status]}`}>
                {run.status}
              </span>
            </h1>
            <p className="text-gray-600">
              {format(new Date(run.payPeriod.startDate), 'MMMM d')} -{' '}
              {format(new Date(run.payPeriod.endDate), 'MMMM d, yyyy')}
              {run.branch && ` · ${run.branch.name}`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap justify-end">
            {canCalculate && (
              <button
                onClick={() => handleAction('calculate')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Calculate
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
            {canPreview && (
              <button
                onClick={fetchPreview}
                disabled={previewLoading}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {previewLoading ? 'Loading...' : 'Preview GL'}
              </button>
            )}
            {canPost && (
              <button
                onClick={() => handleAction('post')}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Post to GL
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
                Export CSV
              </button>
            )}
          </div>
        </div>

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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Employees</div>
            <div className="text-2xl font-bold">{run.lines.length}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Regular Hours</div>
            <div className="text-2xl font-bold">{Number(run.regularHours).toFixed(1)}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Overtime Hours</div>
            <div className="text-2xl font-bold">{Number(run.overtimeHours).toFixed(1)}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Paid Hours</div>
            <div className="text-2xl font-bold">{Number(run.paidHours).toFixed(1)}</div>
          </div>
        </div>

        {run.grossAmount && (
          <div className="bg-white border rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-500">Gross Amount</div>
            <div className="text-3xl font-bold text-green-600">
              ${Number(run.grossAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created by:</span>
              <div>{run.createdBy?.email ?? '—'}</div>
            </div>
            {run.approvedBy && (
              <div>
                <span className="text-gray-500">Approved by:</span>
                <div>{run.approvedBy.email}</div>
              </div>
            )}
            {run.postedBy && (
              <div>
                <span className="text-gray-500">Posted by:</span>
                <div>{run.postedBy.email}</div>
              </div>
            )}
            {run.paidBy && (
              <div>
                <span className="text-gray-500">Paid by:</span>
                <div>{run.paidBy.email}</div>
              </div>
            )}
            {run.voidedBy && (
              <div>
                <span className="text-gray-500">Voided by:</span>
                <div>{run.voidedBy.email}</div>
              </div>
            )}
          </div>
        </div>

        {/* Journal Links */}
        {run.journalLinks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">GL Journal Entries</h2>
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {run.journalLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          link.type === 'ACCRUAL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {link.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">{link.journalEntry.description}</td>
                      <td className="px-4 py-2 text-sm">{link.journalEntry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Employee Line Items</h2>
          {run.lines.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              {run.status === 'DRAFT'
                ? 'Click "Calculate" to compute line items from time entries.'
                : 'No line items found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Regular</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Overtime</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Break</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {run.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2 text-sm">{line.user.name ?? line.user.email}</td>
                      <td className="px-4 py-2 text-sm text-right">{Number(line.regularHours).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">{Number(line.overtimeHours).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">{Number(line.breakHours).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{Number(line.paidHours).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        {line.hourlyRate ? `$${Number(line.hourlyRate).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {line.grossAmount ? `$${Number(line.grossAmount).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-2 text-sm font-medium">Totals</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{Number(run.regularHours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{Number(run.overtimeHours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{Number(run.breakHours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{Number(run.paidHours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right">—</td>
                    <td className="px-4 py-2 text-sm text-right font-bold text-green-600">
                      {run.grossAmount ? `$${Number(run.grossAmount).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* M10.8: GL Posting Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">GL Posting Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Pay Period: {previewData.payPeriod?.start} to {previewData.payPeriod?.end}
                </p>
              </div>

              {/* Totals Summary */}
              {previewData.totals && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs text-gray-500">Gross Earnings</div>
                    <div className="font-semibold">${Number(previewData.totals.grossEarnings || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Net Pay</div>
                    <div className="font-semibold text-green-600">${Number(previewData.totals.netPay || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Taxes Withheld</div>
                    <div className="font-semibold">${Number(previewData.totals.taxesWithheld || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Pre-Tax Deductions</div>
                    <div className="font-semibold">${Number(previewData.totals.preTaxDeductions || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Post-Tax Deductions</div>
                    <div className="font-semibold">${Number(previewData.totals.postTaxDeductions || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Employer Contributions</div>
                    <div className="font-semibold">${Number(previewData.totals.employerContribTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}

              {/* Journal Entries Preview */}
              {previewData.entries && previewData.entries.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Journal Entries</h3>
                  <table className="w-full text-sm border rounded">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.entries.map((entry: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs">{entry.accountCode}</span>
                            <span className="ml-2 text-gray-600">{entry.accountName}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {Number(entry.debit) > 0 ? `$${Number(entry.debit).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {Number(entry.credit) > 0 ? `$${Number(entry.credit).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
