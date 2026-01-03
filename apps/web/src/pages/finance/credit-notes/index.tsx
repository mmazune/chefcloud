/**
 * M8.6: Credit Notes Page
 * 
 * Tabbed view for customer and vendor credit notes with lifecycle management.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, ConfirmDialog } from '@/components/finance';
import type { DocumentStatus } from '@/components/finance';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, 
  Users, 
  Truck,
  CheckCircle,
  XCircle,
  ArrowRight,
  CreditCard,
  Loader2,
} from 'lucide-react';

type TabType = 'customer' | 'vendor';

interface CreditNote {
  id: string;
  number: string | null;
  status: DocumentStatus;
  amount: number;
  allocatedAmount: number;
  refundedAmount: number;
  reason: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
  vendor?: { id: string; name: string };
}

export default function CreditNotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('customer');
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch customer credit notes
  const { data: customerNotes, isLoading: loadingCustomer } = useQuery({
    queryKey: ['credit-notes', 'customer'],
    queryFn: async () => {
      const response = await apiClient.get<CreditNote[]>('/accounting/credit-notes/customer');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch vendor credit notes
  const { data: vendorNotes, isLoading: loadingVendor } = useQuery({
    queryKey: ['credit-notes', 'vendor'],
    queryFn: async () => {
      const response = await apiClient.get<CreditNote[]>('/accounting/credit-notes/vendor');
      return response.data;
    },
    enabled: !!user,
  });

  const isLoading = activeTab === 'customer' ? loadingCustomer : loadingVendor;
  const notes = activeTab === 'customer' ? customerNotes : vendorNotes;

  // Open credit note
  const handleOpen = async (note: CreditNote) => {
    setActionLoading(note.id);
    try {
      await apiClient.post(`/accounting/credit-notes/${activeTab}/${note.id}/open`);
      toast({ title: 'Credit Note Opened', description: 'The credit note is now open.' });
      queryClient.invalidateQueries({ queryKey: ['credit-notes', activeTab] });
    } catch (err: any) {
      toast({
        title: 'Failed to Open',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Void credit note
  const handleVoid = async () => {
    if (!selectedNote) return;
    setActionLoading(selectedNote.id);
    try {
      await apiClient.post(`/accounting/credit-notes/${activeTab}/${selectedNote.id}/void`);
      toast({ title: 'Credit Note Voided', description: 'The credit note has been voided.' });
      queryClient.invalidateQueries({ queryKey: ['credit-notes', activeTab] });
    } catch (err: any) {
      toast({
        title: 'Failed to Void',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
      setShowVoidConfirm(false);
      setSelectedNote(null);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const getAvailableBalance = (note: CreditNote) => {
    return Number(note.amount) - Number(note.allocatedAmount) - Number(note.refundedAmount);
  };

  // Compute stats for active tab
  const stats = {
    total: notes?.length || 0,
    open: notes?.filter(n => n.status === 'OPEN').length || 0,
    totalAmount: notes?.reduce((sum, n) => sum + Number(n.amount), 0) || 0,
    totalAvailable: notes?.filter(n => n.status === 'OPEN').reduce((sum, n) => sum + getAvailableBalance(n), 0) || 0,
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Credit Notes" 
          subtitle="Manage customer and vendor credit notes"
        />

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'customer' ? 'default' : 'outline'}
            onClick={() => setActiveTab('customer')}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Customer Credit Notes
          </Button>
          <Button
            variant={activeTab === 'vendor' ? 'default' : 'outline'}
            onClick={() => setActiveTab('vendor')}
            className="flex items-center gap-2"
          >
            <Truck className="w-4 h-4" />
            Vendor Credit Notes
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Notes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalAvailable)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Notes Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {activeTab === 'customer' ? 'Customer' : 'Vendor'} Credit Notes ({notes?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !notes || notes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No credit notes found</p>
                <p className="text-muted-foreground">
                  {activeTab === 'customer' 
                    ? 'Customer credit notes will appear here'
                    : 'Vendor credit notes will appear here'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>{activeTab === 'customer' ? 'Customer' : 'Vendor'}</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Refunded</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map(note => {
                    const available = getAvailableBalance(note);
                    const partyName = activeTab === 'customer' ? note.customer?.name : note.vendor?.name;
                    const canOpen = note.status === 'DRAFT';
                    const canVoid = ['DRAFT', 'OPEN'].includes(note.status);
                    const canAllocate = note.status === 'OPEN' && available > 0;
                    const canRefund = note.status === 'OPEN' && available > 0;
                    
                    return (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">
                          {note.number || `CN-${note.id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell>{partyName || '-'}</TableCell>
                        <TableCell>{formatDate(note.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={note.status} />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(note.amount))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(note.allocatedAmount))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(note.refundedAmount))}</TableCell>
                        <TableCell className="text-right font-medium">
                          {available > 0 ? formatCurrency(available) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {canOpen && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleOpen(note)}
                                disabled={actionLoading === note.id}
                              >
                                {actionLoading === note.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            {canAllocate && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toast({ title: 'Allocate', description: 'Allocation modal would open here' })}
                              >
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            )}
                            {canRefund && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toast({ title: 'Refund', description: 'Refund modal would open here' })}
                              >
                                <CreditCard className="w-4 h-4" />
                              </Button>
                            )}
                            {canVoid && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedNote(note);
                                  setShowVoidConfirm(true);
                                }}
                                disabled={actionLoading === note.id}
                              >
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Void Confirmation */}
        <ConfirmDialog
          open={showVoidConfirm}
          onOpenChange={setShowVoidConfirm}
          title="Void Credit Note"
          description="Are you sure you want to void this credit note? Any allocations will be reversed."
          confirmLabel="Void"
          onConfirm={handleVoid}
          isLoading={!!actionLoading}
          variant="destructive"
        />
      </AppShell>
    </RequireRole>
  );
}
