/**
 * M11.7: Inventory Lots Page
 * 
 * Dedicated page for viewing and managing inventory lots/batches.
 * Features:
 * - List all lots with lot number, item, quantity, expiry
 * - Filter by status, branch, item
 * - View lot details and traceability
 * - Quarantine/release lots
 * - Expiring soon alerts
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { Search, Package, AlertTriangle, Clock, Shield, CheckCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface InventoryLot {
  id: string;
  lotNumber: string;
  itemId: string;
  itemName: string;
  branchId: string;
  locationId: string;
  receivedQty: number;
  remainingQty: number;
  expiryDate: string | null;
  status: 'ACTIVE' | 'QUARANTINE' | 'EXPIRED' | 'DEPLETED';
  daysToExpiry: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  createdAt: string;
}

interface TraceabilityEntry {
  id: string;
  sourceType: string;
  sourceId: string;
  allocatedQty: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  QUARANTINE: 'secondary',
  EXPIRED: 'destructive',
  DEPLETED: 'outline',
};

export default function InventoryLotsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null);
  const [traceabilityOpen, setTraceabilityOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch lots
  const { data: lotsData, isLoading } = useQuery({
    queryKey: ['inventory-lots', statusFilter, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (activeTab === 'expiring') {
        const response = await apiClient.get<{ items: InventoryLot[] }>(`/inventory/lots/expiring-soon?days=30`);
        return { items: response.data.items, total: response.data.items.length };
      }
      params.set('includeExpired', statusFilter === 'EXPIRED' ? 'true' : 'false');
      params.set('includeDepleted', statusFilter === 'DEPLETED' ? 'true' : 'false');
      const response = await apiClient.get<{ items: InventoryLot[]; total: number }>(`/inventory/lots?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch traceability
  const { data: traceabilityData } = useQuery({
    queryKey: ['lot-traceability', selectedLot?.id],
    queryFn: async () => {
      if (!selectedLot) return null;
      const response = await apiClient.get<{
        lot: InventoryLot;
        allocations: TraceabilityEntry[];
        summary: { total: number; bySourceType: Record<string, number> };
      }>(`/inventory/lots/${selectedLot.id}/traceability`);
      return response.data;
    },
    enabled: !!selectedLot && traceabilityOpen,
  });

  // Quarantine mutation
  const quarantineMutation = useMutation({
    mutationFn: async (lotId: string) => {
      const response = await apiClient.post(`/inventory/lots/${lotId}/quarantine`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      toast({ title: 'Lot quarantined', description: 'The lot has been placed in quarantine.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to quarantine lot.', variant: 'destructive' });
    },
  });

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: async (lotId: string) => {
      const response = await apiClient.post(`/inventory/lots/${lotId}/release`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      toast({ title: 'Lot released', description: 'The lot has been released from quarantine.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to release lot.', variant: 'destructive' });
    },
  });

  const lots = lotsData?.items || [];
  const filteredLots = search
    ? lots.filter(
        (lot) =>
          lot.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
          lot.itemName.toLowerCase().includes(search.toLowerCase())
      )
    : lots;

  const columns = [
    {
      accessorKey: 'lotNumber',
      header: 'Lot Number',
      cell: ({ row }: { row: { original: InventoryLot } }) => (
        <div className="font-mono font-medium">{row.original.lotNumber}</div>
      ),
    },
    {
      accessorKey: 'itemName',
      header: 'Item',
    },
    {
      accessorKey: 'remainingQty',
      header: 'Remaining',
      cell: ({ row }: { row: { original: InventoryLot } }) => (
        <div className="flex items-center gap-2">
          <span>{Number(row.original.remainingQty).toFixed(2)}</span>
          <span className="text-muted-foreground text-xs">
            / {Number(row.original.receivedQty).toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'expiryDate',
      header: 'Expiry',
      cell: ({ row }: { row: { original: InventoryLot } }) => {
        const lot = row.original;
        if (!lot.expiryDate) return <span className="text-muted-foreground">N/A</span>;
        
        const expiry = new Date(lot.expiryDate);
        const formattedDate = format(expiry, 'MMM d, yyyy');
        
        if (lot.isExpired) {
          return (
            <div className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          );
        }
        
        if (lot.isExpiringSoon) {
          return (
            <div className="flex items-center gap-1 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span>{formattedDate}</span>
              <Badge variant="outline" className="ml-1 text-xs">
                {lot.daysToExpiry}d
              </Badge>
            </div>
          );
        }
        
        return <span>{formattedDate}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: { original: InventoryLot } }) => (
        <Badge variant={STATUS_COLORS[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: InventoryLot } }) => {
        const lot = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedLot(lot);
                setTraceabilityOpen(true);
              }}
            >
              Traceability
            </Button>
            {lot.status === 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => quarantineMutation.mutate(lot.id)}
                disabled={quarantineMutation.isPending}
              >
                <Shield className="h-4 w-4 mr-1" />
                Quarantine
              </Button>
            )}
            {lot.status === 'QUARANTINE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => releaseMutation.mutate(lot.id)}
                disabled={releaseMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Release
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Summary stats
  const activeLots = lots.filter((l) => l.status === 'ACTIVE').length;
  const expiringSoonLots = lots.filter((l) => l.isExpiringSoon).length;
  const expiredLots = lots.filter((l) => l.isExpired).length;
  const quarantinedLots = lots.filter((l) => l.status === 'QUARANTINE').length;

  return (
    <AppShell>
      <PageHeader
        title="Inventory Lots"
        subtitle="Manage lot/batch tracking with FEFO allocation"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lots..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Lots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{activeLots}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold">{expiringSoonLots}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold">{expiredLots}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quarantined</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <span className="text-2xl font-bold">{quarantinedLots}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Data */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Lots</TabsTrigger>
          <TabsTrigger value="expiring">
            Expiring Soon
            {expiringSoonLots > 0 && (
              <Badge variant="destructive" className="ml-2">
                {expiringSoonLots}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lots</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="DEPLETED">Depleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={filteredLots}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Lots Expiring Within 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={filteredLots}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Traceability Dialog */}
      <Dialog open={traceabilityOpen} onOpenChange={setTraceabilityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lot Traceability: {selectedLot?.lotNumber}</DialogTitle>
          </DialogHeader>
          
          {selectedLot && (
            <div className="space-y-4">
              {/* Lot Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Item</div>
                  <div className="font-medium">{selectedLot.itemName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={STATUS_COLORS[selectedLot.status]}>
                    {selectedLot.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Received</div>
                  <div className="font-medium">{Number(selectedLot.receivedQty).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div className="font-medium">{Number(selectedLot.remainingQty).toFixed(2)}</div>
                </div>
                {selectedLot.expiryDate && (
                  <div>
                    <div className="text-sm text-muted-foreground">Expiry Date</div>
                    <div className="font-medium">
                      {format(new Date(selectedLot.expiryDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary by source type */}
              {traceabilityData?.summary && (
                <div>
                  <h4 className="font-medium mb-2">Allocation Summary</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(traceabilityData.summary.bySourceType).map(([type, qty]) => (
                      <Badge key={type} variant="outline">
                        {type}: {Number(qty).toFixed(2)}
                      </Badge>
                    ))}
                    <Badge variant="secondary">
                      Total: {Number(traceabilityData.summary.total).toFixed(2)}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Allocation History */}
              <div>
                <h4 className="font-medium mb-2">Allocation History</h4>
                {traceabilityData?.allocations && traceabilityData.allocations.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {traceabilityData.allocations.map((alloc) => (
                      <div
                        key={alloc.id}
                        className="flex items-center justify-between p-2 border rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{alloc.sourceType}</Badge>
                          <span className="font-mono text-xs">{alloc.sourceId}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">
                            -{Number(alloc.allocatedQty).toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(alloc.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No allocations recorded yet.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTraceabilityOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
