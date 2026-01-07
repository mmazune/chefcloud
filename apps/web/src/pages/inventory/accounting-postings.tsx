/**
 * M11.13: Inventory GL Postings Page
 * 
 * View and export GL journal entries created from inventory transactions.
 * Features:
 * - Filter by date range, event type, status
 * - Preview posting details
 * - Export to CSV with UTF-8 BOM + SHA-256 hash
 * - L3+ RBAC required (Supervisor+)
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Download,
  RefreshCw,
  Search,
  BookOpen,
  Receipt,
  ShoppingCart,
  Trash2,
  ClipboardCheck,
  Eye,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface PostingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface Posting {
  id: string;
  eventType: 'GOODS_RECEIPT' | 'DEPLETION' | 'WASTE' | 'STOCKTAKE';
  eventId: string;
  eventNumber: string;
  journalEntryId: string | null;
  journalNumber: string | null;
  status: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED';
  errorMessage: string | null;
  amount: number;
  branchId: string;
  branchName: string;
  postedAt: string | null;
  createdAt: string;
  lines?: PostingLine[];
}

interface PostingsResponse {
  success: boolean;
  data: Posting[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const eventTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  GOODS_RECEIPT: { label: 'Goods Receipt', icon: <Receipt className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800' },
  DEPLETION: { label: 'Depletion', icon: <ShoppingCart className="h-3 w-3" />, color: 'bg-green-100 text-green-800' },
  WASTE: { label: 'Waste', icon: <Trash2 className="h-3 w-3" />, color: 'bg-red-100 text-red-800' },
  STOCKTAKE: { label: 'Stocktake', icon: <ClipboardCheck className="h-3 w-3" />, color: 'bg-purple-100 text-purple-800' },
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  POSTED: { label: 'Posted', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default' },
  PENDING: { label: 'Pending', icon: <Clock className="h-3 w-3" />, variant: 'outline' },
  FAILED: { label: 'Failed', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
  SKIPPED: { label: 'Skipped', icon: <AlertTriangle className="h-3 w-3" />, variant: 'secondary' },
};

export default function AccountingPostingsPage() {
  // Filter state
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Default date range: last 30 days
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState<Date>(monthAgo);
  const [toDate, setToDate] = useState<Date>(today);

  // Preview state
  const [previewPosting, setPreviewPosting] = useState<Posting | null>(null);

  // Fetch postings
  const { data: postingsData, isLoading, refetch } = useQuery({
    queryKey: ['inventory-gl-postings', fromDate, toDate, eventType, status, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        page,
        limit,
      };
      if (eventType) params.eventType = eventType;
      if (status) params.status = status;

      const response = await apiClient.get<PostingsResponse>('/inventory/gl/postings', { params });
      return response.data;
    },
    enabled: !!fromDate && !!toDate,
  });

  // Fetch summary stats
  const { data: statusData } = useQuery({
    queryKey: ['inventory-gl-status'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          hasOrgMapping: boolean;
          branchMappingsCount: number;
          totalPostings: number;
          postedCount: number;
          failedCount: number;
          skippedCount: number;
        };
      }>('/inventory/gl/status');
      return response.data.data;
    },
  });

  // Handle CSV export
  const handleExport = async () => {
    try {
      const params: Record<string, string> = {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      };
      if (eventType) params.eventType = eventType;
      if (status) params.status = status;

      const response = await apiClient.get('/inventory/gl/postings/export', {
        params,
        responseType: 'blob',
      });

      // Get hash from header
      const hash = response.headers['x-content-sha256'];

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-gl-postings-${fromDate.toISOString().slice(0, 10)}-to-${toDate.toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        <div>
          <p>Export downloaded successfully</p>
          {hash && <p className="text-xs text-muted-foreground">SHA-256: {hash.slice(0, 16)}...</p>}
        </div>
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export postings');
    }
  };

  // Fetch preview details
  const handlePreview = async (posting: Posting) => {
    try {
      const response = await apiClient.get<{ success: boolean; data: Posting }>(
        `/inventory/gl/preview`,
        { params: { eventType: posting.eventType, eventId: posting.eventId } }
      );
      setPreviewPosting(response.data.data);
    } catch (error: any) {
      // Use the basic posting data if preview fails
      setPreviewPosting(posting);
    }
  };

  // Table columns
  const columns = [
    {
      accessorKey: 'eventType',
      header: 'Type',
      cell: ({ row }: any) => {
        const type = row.original.eventType as string;
        const config = eventTypeConfig[type] || { label: type, icon: null, color: 'bg-gray-100' };
        return (
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            {config.icon}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'eventNumber',
      header: 'Event #',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm">{row.original.eventNumber}</span>
      ),
    },
    {
      accessorKey: 'branchName',
      header: 'Branch',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }: any) => (
        <span className="font-mono">
          ${Math.abs(row.original.amount).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.status as string;
        const config = statusConfig[status] || { label: status, icon: null, variant: 'outline' as const };
        return (
          <Badge variant={config.variant} className="gap-1">
            {config.icon}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'journalNumber',
      header: 'Journal #',
      cell: ({ row }: any) => {
        const jn = row.original.journalNumber;
        return jn ? (
          <span className="font-mono text-sm">{jn}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'postedAt',
      header: 'Posted At',
      cell: ({ row }: any) => {
        const date = row.original.postedAt;
        return date ? (
          <span className="text-sm">{new Date(date).toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <Button variant="ghost" size="icon" onClick={() => handlePreview(row.original)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const postings = postingsData?.data ?? [];
  const meta = postingsData?.meta;

  return (
    <AppShell>
      <PageHeader
        title="Inventory GL Postings"
        description="View journal entries created from inventory transactions"
        icon={FileText}
      />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Postings</div>
            <div className="text-2xl font-bold">{statusData?.totalPostings ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Posted
            </div>
            <div className="text-2xl font-bold text-green-600">{statusData?.postedCount ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed
            </div>
            <div className="text-2xl font-bold text-red-600">{statusData?.failedCount ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Skipped
            </div>
            <div className="text-2xl font-bold text-yellow-600">{statusData?.skippedCount ?? 0}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date Range */}
            <div className="flex gap-2 items-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <DatePicker
                value={fromDate}
                onChange={(date) => date && setFromDate(date)}
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <DatePicker
                value={toDate}
                onChange={(date) => date && setToDate(date)}
                placeholder="To"
              />
            </div>

            {/* Event Type Filter */}
            <div className="w-48">
              <Select value={eventType} onValueChange={setEventType}>
                <option value="">All Event Types</option>
                <option value="GOODS_RECEIPT">Goods Receipt</option>
                <option value="DEPLETION">Depletion</option>
                <option value="WASTE">Waste</option>
                <option value="STOCKTAKE">Stocktake</option>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-40">
              <Select value={status} onValueChange={setStatus}>
                <option value="">All Statuses</option>
                <option value="POSTED">Posted</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED">Skipped</option>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Postings Table */}
        <Card className="p-4">
          <DataTable columns={columns} data={postings} isLoading={isLoading} />

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(meta.page - 1) * meta.limit + 1} -{' '}
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(meta.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(meta.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewPosting} onOpenChange={() => setPreviewPosting(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Posting Details
            </DialogTitle>
          </DialogHeader>

          {previewPosting && (
            <div className="space-y-4">
              {/* Event Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Event Type</div>
                  <div className="font-medium">
                    {eventTypeConfig[previewPosting.eventType]?.label || previewPosting.eventType}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Event Number</div>
                  <div className="font-mono">{previewPosting.eventNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Branch</div>
                  <div>{previewPosting.branchName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="font-mono">${Math.abs(previewPosting.amount).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={statusConfig[previewPosting.status]?.variant || 'outline'}>
                    {previewPosting.status}
                  </Badge>
                </div>
                {previewPosting.journalNumber && (
                  <div>
                    <div className="text-sm text-muted-foreground">Journal Number</div>
                    <div className="font-mono">{previewPosting.journalNumber}</div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {previewPosting.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="text-sm font-medium text-red-800">Error</div>
                  <div className="text-sm text-red-700">{previewPosting.errorMessage}</div>
                </div>
              )}

              {/* Journal Lines */}
              {previewPosting.lines && previewPosting.lines.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Journal Lines</div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Account</th>
                        <th className="text-right p-2">Debit</th>
                        <th className="text-right p-2">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPosting.lines.map((line, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">
                            <span className="font-mono text-muted-foreground mr-2">
                              {line.accountCode}
                            </span>
                            {line.accountName}
                          </td>
                          <td className="text-right p-2 font-mono">
                            {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                          </td>
                          <td className="text-right p-2 font-mono">
                            {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-medium">
                      <tr>
                        <td className="p-2">Total</td>
                        <td className="text-right p-2 font-mono">
                          $
                          {previewPosting.lines
                            .reduce((sum, l) => sum + l.debit, 0)
                            .toFixed(2)}
                        </td>
                        <td className="text-right p-2 font-mono">
                          $
                          {previewPosting.lines
                            .reduce((sum, l) => sum + l.credit, 0)
                            .toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
