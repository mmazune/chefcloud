import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, FileText, Receipt, FileSpreadsheet, FileCheck } from 'lucide-react';

// Document types matching backend schema
type DocumentCategory = 
  | 'INVOICE' 
  | 'STOCK_RECEIPT' 
  | 'CONTRACT' 
  | 'HR_DOC' 
  | 'BANK_STATEMENT' 
  | 'PAYSLIP' 
  | 'RESERVATION_DOC' 
  | 'OTHER';

interface Document {
  id: string;
  orgId: string;
  branchId: string | null;
  fileName: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  storageProvider: 'LOCAL' | 'S3' | 'GCS';
  uploadedById: string;
  uploadedAt: string;
  tags: string[];
  notes: string | null;
  // Entity links
  serviceProviderId: string | null;
  purchaseOrderId: string | null;
  goodsReceiptId: string | null;
  stockBatchId: string | null;
  payRunId: string | null;
  paySlipId: string | null;
  reservationId: string | null;
  eventBookingId: string | null;
  bankStatementId: string | null;
  employeeId: string | null;
  fiscalInvoiceId: string | null;
  // Populated data
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface DocumentsResponse {
  documents: Document[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    // Default to last 30 days
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });

  // TODO: Get from user context
  const branchId = 'branch-1';

  // Fetch documents
  const { data, isLoading } = useQuery<DocumentsResponse>({
    queryKey: ['documents', categoryFilter, branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      params.append('limit', '200');
      
      const res = await fetch(`${API_URL}/documents?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });

  const documents = useMemo(() => data?.documents || [], [data]);

  // Filter by search term and date range (client-side)
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((doc) => {
        const docDate = new Date(doc.uploadedAt);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        
        if (fromDate && docDate < fromDate) return false;
        if (toDate) {
          const endOfDay = new Date(toDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (docDate > endOfDay) return false;
        }
        return true;
      });
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((doc) => {
        const fileName = doc.fileName?.toLowerCase() || '';
        const category = doc.category?.toLowerCase() || '';
        const uploaderName = doc.uploader 
          ? `${doc.uploader.firstName} ${doc.uploader.lastName}`.toLowerCase()
          : '';
        
        return (
          fileName.includes(searchLower) ||
          category.includes(searchLower) ||
          uploaderName.includes(searchLower) ||
          getLinkedEntityDisplay(doc).toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [documents, search, dateFrom, dateTo]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = filteredDocuments.length;
    
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    const last7Days = filteredDocuments.filter((doc) => {
      const uploadDate = new Date(doc.uploadedAt);
      return uploadDate >= sevenDaysAgo;
    }).length;

    const invoices = filteredDocuments.filter(
      (doc) => doc.category === 'INVOICE' || doc.category === 'STOCK_RECEIPT'
    ).length;

    const payslips = filteredDocuments.filter(
      (doc) => doc.category === 'PAYSLIP'
    ).length;

    return { total, last7Days, invoices, payslips };
  }, [filteredDocuments]);

  // Helper functions
  const getCategoryBadgeColor = (category: DocumentCategory): string => {
    const colors: Record<DocumentCategory, string> = {
      INVOICE: 'bg-blue-100 text-blue-800',
      STOCK_RECEIPT: 'bg-green-100 text-green-800',
      CONTRACT: 'bg-purple-100 text-purple-800',
      HR_DOC: 'bg-orange-100 text-orange-800',
      BANK_STATEMENT: 'bg-indigo-100 text-indigo-800',
      PAYSLIP: 'bg-yellow-100 text-yellow-800',
      RESERVATION_DOC: 'bg-pink-100 text-pink-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category: DocumentCategory): string => {
    const labels: Record<DocumentCategory, string> = {
      INVOICE: 'Invoice',
      STOCK_RECEIPT: 'Stock Receipt',
      CONTRACT: 'Contract',
      HR_DOC: 'HR Document',
      BANK_STATEMENT: 'Bank Statement',
      PAYSLIP: 'Payslip',
      RESERVATION_DOC: 'Reservation',
      OTHER: 'Other',
    };
    return labels[category] || category;
  };

  const getLinkedEntityDisplay = (doc: Document): string => {
    if (doc.purchaseOrderId) return `PO: ${doc.purchaseOrderId.substring(0, 8)}`;
    if (doc.goodsReceiptId) return `GR: ${doc.goodsReceiptId.substring(0, 8)}`;
    if (doc.serviceProviderId) return `Provider: ${doc.serviceProviderId.substring(0, 8)}`;
    if (doc.reservationId) return `Reservation: ${doc.reservationId.substring(0, 8)}`;
    if (doc.eventBookingId) return `Event: ${doc.eventBookingId.substring(0, 8)}`;
    if (doc.employeeId) return `Employee: ${doc.employeeId.substring(0, 8)}`;
    if (doc.paySlipId) return `Payslip: ${doc.paySlipId.substring(0, 8)}`;
    if (doc.bankStatementId) return `Bank: ${doc.bankStatementId.substring(0, 8)}`;
    if (doc.fiscalInvoiceId) return `Invoice: ${doc.fiscalInvoiceId.substring(0, 8)}`;
    return '—';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = (docId: string) => {
    window.open(`${API_URL}/documents/${docId}/download`, '_blank');
  };

  const setQuickFilter = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Documents & Receipts"
        subtitle="Central view of invoices, receipts, payslips and other documents."
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold">{summaryStats.total}</p>
              <p className="text-xs text-gray-500">in current filter</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Last 7 Days</p>
              <p className="text-2xl font-bold">{summaryStats.last7Days}</p>
              <p className="text-xs text-gray-500">recently uploaded</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Receipt className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Invoices & Receipts</p>
              <p className="text-2xl font-bold">{summaryStats.invoices}</p>
              <p className="text-xs text-gray-500">purchase documents</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Payslips</p>
              <p className="text-2xl font-bold">{summaryStats.payslips}</p>
              <p className="text-xs text-gray-500">employee payslips</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="space-y-4">
          {/* Category Filters */}
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'INVOICE', 'STOCK_RECEIPT', 'PAYSLIP', 'CONTRACT', 'RESERVATION_DOC', 'OTHER'].map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter(cat as DocumentCategory | 'ALL')}
                >
                  {cat === 'ALL' ? 'All' : getCategoryLabel(cat as DocumentCategory)}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Quick Filters</label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setQuickFilter(1)}>
                  Today
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQuickFilter(7)}>
                  7 Days
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQuickFilter(30)}>
                  30 Days
                </Button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by filename, category, uploader, or linked entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Documents Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Documents ({filteredDocuments.length})
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No documents found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                  <th className="pb-3 pr-4">File Name</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Linked To</th>
                  <th className="pb-3 pr-4">Uploaded By</th>
                  <th className="pb-3 pr-4">Uploaded At</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium truncate max-w-xs" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={getCategoryBadgeColor(doc.category)}>
                        {getCategoryLabel(doc.category)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {getLinkedEntityDisplay(doc)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {doc.uploader 
                        ? `${doc.uploader.firstName} ${doc.uploader.lastName}`
                        : '—'
                      }
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {formatFileSize(doc.sizeBytes)}
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(doc.id)}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
