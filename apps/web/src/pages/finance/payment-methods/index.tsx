/**
 * M8.6: Payment Methods Page
 * 
 * Map payment methods to GL accounts for proper accounting integration.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  CreditCard,
  Settings,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  glAccountId: string | null;
  glAccount?: {
    id: string;
    code: string;
    name: string;
  };
}

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const response = await apiClient.get<PaymentMethod[]>('/accounting/payment-methods');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch GL accounts for mapping
  const { data: glAccounts } = useQuery({
    queryKey: ['gl-accounts', 'asset'],
    queryFn: async () => {
      const response = await apiClient.get<GLAccount[]>('/accounting/accounts?type=ASSET');
      return response.data;
    },
    enabled: !!user,
  });

  // Map payment method to GL account
  const mapMutation = useMutation({
    mutationFn: async ({ methodId, accountId }: { methodId: string; accountId: string }) => {
      return apiClient.patch(`/accounting/payment-methods/${methodId}`, {
        glAccountId: accountId || null,
      });
    },
    onSuccess: () => {
      toast({ title: 'Mapping Updated', description: 'Payment method GL mapping saved.' });
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setShowMappingDialog(false);
      setSelectedMethod(null);
      setSelectedAccountId('');
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Update',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleOpenMapping = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setSelectedAccountId(method.glAccountId || '');
    setShowMappingDialog(true);
  };

  const handleSaveMapping = () => {
    if (!selectedMethod) return;
    mapMutation.mutate({
      methodId: selectedMethod.id,
      accountId: selectedAccountId,
    });
  };

  // Compute stats
  const stats = {
    total: paymentMethods?.length || 0,
    active: paymentMethods?.filter(m => m.isActive).length || 0,
    mapped: paymentMethods?.filter(m => m.glAccountId).length || 0,
    unmapped: paymentMethods?.filter(m => !m.glAccountId).length || 0,
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CASH: 'Cash',
      CARD: 'Card',
      DIGITAL_WALLET: 'Digital Wallet',
      BANK_TRANSFER: 'Bank Transfer',
      CHECK: 'Check',
      OTHER: 'Other',
    };
    return labels[type] || type;
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader
          title="Payment Methods"
          subtitle="Map payment methods to GL accounts"
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Methods</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Mapped to GL</p>
              <p className="text-2xl font-bold text-blue-600">{stats.mapped}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Unmapped</p>
              <p className="text-2xl font-bold text-amber-600">{stats.unmapped}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Methods ({paymentMethods?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !paymentMethods || paymentMethods.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No payment methods configured</p>
                <p className="text-muted-foreground">
                  Payment methods will appear here once configured in settings.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GL Account</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map(method => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">
                        {method.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPaymentTypeLabel(method.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={method.isActive ? 'default' : 'secondary'}>
                          {method.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {method.glAccount ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <Check className="w-4 h-4" />
                            <span className="font-mono text-sm">
                              {method.glAccount.code}
                            </span>
                            <span className="text-muted-foreground">
                              - {method.glAccount.name}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">Not mapped</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMapping(method)}
                        >
                          <LinkIcon className="w-4 h-4 mr-2" />
                          {method.glAccountId ? 'Update' : 'Map'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* GL Account Mapping Help */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="w-4 h-4" />
              About GL Mapping
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Payment method GL mapping determines which General Ledger account is credited
              when payments are received or debited when refunds are issued.
            </p>
            <p>
              <strong>Best Practice:</strong> Map each payment method to a corresponding
              asset account (e.g., Cash on Hand for cash, Bank Account for cards).
            </p>
            <p>
              Unmapped payment methods will use the default Cash account if configured in
              your organization settings.
            </p>
          </CardContent>
        </Card>

        {/* GL Account Mapping Dialog */}
        <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Map GL Account - {selectedMethod?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>GL Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a GL account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (use default)</SelectItem>
                    {glAccounts?.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select the GL asset account where payments using this method will be recorded.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMapping} disabled={mapMutation.isPending}>
                {mapMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save Mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </RequireRole>
  );
}
