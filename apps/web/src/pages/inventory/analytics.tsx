/**
 * M11.12: Inventory Analytics Dashboard
 * 
 * Displays key inventory KPIs:
 * - Shrink/Variance analysis
 * - Dead Stock identification
 * - Expiry Risk by bucket
 * - Reorder Health status
 * 
 * Features:
 * - Summary cards with quick stats
 * - Tabbed drilldown for each KPI
 * - Export to CSV with hash verification
 * - L2+ RBAC for read, L4+ for exports
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { 
  Download, 
  RefreshCw, 
  TrendingDown, 
  AlertTriangle, 
  Calendar, 
  Package,
  ShoppingCart,
} from 'lucide-react';

// ============================================
// Interfaces
// ============================================

interface AnalyticsSummary {
  shrink: {
    totalVarianceQty: string;
    totalVarianceValue: string;
    itemCount: number;
  };
  waste: {
    totalWasteQty: string;
    totalWasteValue: string;
    topItemsCount: number;
  };
  deadStock: {
    itemCount: number;
    totalOnHand: string;
  };
  expiryRisk: {
    expiredCount: number;
    within7Count: number;
    within30Count: number;
    within60Count: number;
  };
  reorderHealth: {
    belowReorderCount: number;
    suggestionRunsTotal: number;
  };
}

interface ShrinkResult {
  branchId: string;
  branchName: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  varianceQty: string;
  varianceValue: string;
  sessionCount: number;
}

interface DeadStockResult {
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  onHand: string;
  lastMovementDate: string | null;
  daysSinceMovement: number;
}

interface ExpiryRiskBucket {
  bucket: 'expired' | 'within7' | 'within30' | 'within60';
  lotCount: number;
  totalQty: string;
  lots: ExpiryLot[];
}

interface ExpiryLot {
  lotId: string;
  lotNumber: string;
  itemId: string;
  itemName: string;
  expiryDate: string;
  daysToExpiry: number;
  qty: string;
  status: string;
}

interface ReorderHealthResult {
  belowReorderCount: number;
  suggestionRunsTotal: number;
  suggestionsActionedCount: number;
  itemsBelowReorder: {
    itemId: string;
    itemName: string;
    sku: string | null;
    onHand: string;
    reorderLevel: string;
    shortfall: string;
  }[];
}

// ============================================
// Component
// ============================================

export default function InventoryAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [deadStockDays, setDeadStockDays] = useState(30);

  // Fetch summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['inventory-analytics-summary'],
    queryFn: async () => {
      const response = await apiClient.get<AnalyticsSummary>('/inventory/analytics/summary');
      return response.data;
    },
  });

  // Fetch shrink data
  const { data: shrinkData, isLoading: shrinkLoading } = useQuery({
    queryKey: ['inventory-analytics-shrink'],
    queryFn: async () => {
      const response = await apiClient.get<ShrinkResult[]>('/inventory/analytics/shrink');
      return response.data;
    },
    enabled: activeTab === 'shrink',
  });

  // Fetch dead stock
  const { data: deadStockData, isLoading: deadStockLoading } = useQuery({
    queryKey: ['inventory-analytics-dead-stock', deadStockDays],
    queryFn: async () => {
      const response = await apiClient.get<DeadStockResult[]>('/inventory/analytics/dead-stock', {
        params: { deadStockDays: deadStockDays.toString() },
      });
      return response.data;
    },
    enabled: activeTab === 'deadStock',
  });

  // Fetch expiry risk
  const { data: expiryData, isLoading: expiryLoading } = useQuery({
    queryKey: ['inventory-analytics-expiry-risk'],
    queryFn: async () => {
      const response = await apiClient.get<ExpiryRiskBucket[]>('/inventory/analytics/expiry-risk');
      return response.data;
    },
    enabled: activeTab === 'expiry',
  });

  // Fetch reorder health
  const { data: reorderData, isLoading: reorderLoading } = useQuery({
    queryKey: ['inventory-analytics-reorder-health'],
    queryFn: async () => {
      const response = await apiClient.get<ReorderHealthResult>('/inventory/analytics/reorder-health');
      return response.data;
    },
    enabled: activeTab === 'reorder',
  });

  // Export handlers
  const handleExport = async (endpoint: string, filename: string) => {
    try {
      const response = await apiClient.get(`/inventory/analytics/${endpoint}/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getSeverityBadge = (count: number, threshold: number) => {
    if (count === 0) return <Badge variant="success">0</Badge>;
    if (count > threshold) return <Badge variant="destructive">{count}</Badge>;
    return <Badge variant="warning">{count}</Badge>;
  };

  return (
    <AppShell>
      <PageHeader
        title="Inventory Analytics"
        subtitle="KPI dashboard for shrink, dead stock, expiry risk, and reorder health"
        actions={
          <Button variant="outline" onClick={() => refetchSummary()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingDown className="h-4 w-4" />
            <span className="text-sm">Shrink</span>
          </div>
          <div className="text-2xl font-bold">
            {summary?.shrink.itemCount ?? 0} items
          </div>
          <div className="text-sm text-muted-foreground">
            ${parseFloat(summary?.shrink.totalVarianceValue ?? '0').toFixed(2)} variance
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Waste</span>
          </div>
          <div className="text-2xl font-bold">
            {summary?.waste.topItemsCount ?? 0} items
          </div>
          <div className="text-sm text-muted-foreground">
            ${parseFloat(summary?.waste.totalWasteValue ?? '0').toFixed(2)} total
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4" />
            <span className="text-sm">Dead Stock</span>
          </div>
          <div className="text-2xl font-bold">
            {getSeverityBadge(summary?.deadStock.itemCount ?? 0, 10)}
          </div>
          <div className="text-sm text-muted-foreground">
            {parseFloat(summary?.deadStock.totalOnHand ?? '0').toFixed(2)} qty on hand
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Expiry Risk</span>
          </div>
          <div className="text-2xl font-bold flex gap-2">
            {getSeverityBadge(summary?.expiryRisk.expiredCount ?? 0, 0)}
            {getSeverityBadge(summary?.expiryRisk.within7Count ?? 0, 5)}
          </div>
          <div className="text-sm text-muted-foreground">
            Expired / Within 7 days
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm">Reorder Health</span>
          </div>
          <div className="text-2xl font-bold">
            {getSeverityBadge(summary?.reorderHealth.belowReorderCount ?? 0, 5)}
          </div>
          <div className="text-sm text-muted-foreground">
            Below reorder point
          </div>
        </Card>
      </div>

      {/* Tabbed Detail Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="shrink">Shrink</TabsTrigger>
          <TabsTrigger value="deadStock">Dead Stock</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Risk</TabsTrigger>
          <TabsTrigger value="reorder">Reorder Health</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Analytics Overview</h3>
            <p className="text-muted-foreground">
              Select a tab above to drill down into specific KPIs. 
              Use the export buttons in each section to download CSV reports.
            </p>
          </Card>
        </TabsContent>

        {/* Shrink Tab */}
        <TabsContent value="shrink">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Shrink / Variance Analysis</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('shrink', 'shrink-analytics.csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            {shrinkLoading ? (
              <p>Loading...</p>
            ) : (
              <DataTable
                data={shrinkData ?? []}
                columns={[
                  { header: 'Branch', accessorKey: 'branchName' },
                  { header: 'Location', accessorKey: 'locationName' },
                  { header: 'Item', accessorKey: 'itemName' },
                  { header: 'SKU', accessorKey: 'sku' },
                  { header: 'Variance Qty', accessorKey: 'varianceQty' },
                  { header: 'Variance $', accessorKey: 'varianceValue' },
                  { header: 'Sessions', accessorKey: 'sessionCount' },
                ]}
              />
            )}
          </Card>
        </TabsContent>

        {/* Dead Stock Tab */}
        <TabsContent value="deadStock">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">Dead Stock Items</h3>
                <select 
                  value={deadStockDays} 
                  onChange={(e) => setDeadStockDays(parseInt(e.target.value))}
                  className="border rounded px-2 py-1"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('dead-stock', 'dead-stock-analytics.csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            {deadStockLoading ? (
              <p>Loading...</p>
            ) : (
              <DataTable
                data={deadStockData ?? []}
                columns={[
                  { header: 'Branch', accessorKey: 'branchName' },
                  { header: 'Item', accessorKey: 'itemName' },
                  { header: 'SKU', accessorKey: 'sku' },
                  { header: 'On Hand', accessorKey: 'onHand' },
                  { header: 'Days Since Movement', accessorKey: 'daysSinceMovement' },
                  { 
                    header: 'Last Movement', 
                    accessorKey: 'lastMovementDate',
                    cell: ({ row }) => row.original.lastMovementDate 
                      ? new Date(row.original.lastMovementDate).toLocaleDateString() 
                      : 'Never',
                  },
                ]}
              />
            )}
          </Card>
        </TabsContent>

        {/* Expiry Risk Tab */}
        <TabsContent value="expiry">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Expiry Risk by Bucket</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('expiry-risk', 'expiry-risk-analytics.csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            {expiryLoading ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-6">
                {expiryData?.map((bucket) => (
                  <div key={bucket.bucket} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant={
                          bucket.bucket === 'expired' ? 'destructive' :
                          bucket.bucket === 'within7' ? 'warning' : 'secondary'
                        }
                      >
                        {bucket.bucket === 'expired' ? 'Expired' :
                         bucket.bucket === 'within7' ? 'Within 7 Days' :
                         bucket.bucket === 'within30' ? 'Within 30 Days' : 'Within 60 Days'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {bucket.lotCount} lots, {bucket.totalQty} qty
                      </span>
                    </div>
                    {bucket.lots.length > 0 && (
                      <DataTable
                        data={bucket.lots}
                        columns={[
                          { header: 'Lot #', accessorKey: 'lotNumber' },
                          { header: 'Item', accessorKey: 'itemName' },
                          { 
                            header: 'Expiry', 
                            accessorKey: 'expiryDate',
                            cell: ({ row }) => new Date(row.original.expiryDate).toLocaleDateString(),
                          },
                          { header: 'Days Left', accessorKey: 'daysToExpiry' },
                          { header: 'Qty', accessorKey: 'qty' },
                        ]}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Reorder Health Tab */}
        <TabsContent value="reorder">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Reorder Health</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('reorder-health', 'reorder-health-analytics.csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            {reorderLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Below Reorder</div>
                    <div className="text-2xl font-bold">{reorderData?.belowReorderCount ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Suggestion Runs</div>
                    <div className="text-2xl font-bold">{reorderData?.suggestionRunsTotal ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Actioned</div>
                    <div className="text-2xl font-bold">{reorderData?.suggestionsActionedCount ?? 0}</div>
                  </Card>
                </div>
                <DataTable
                  data={reorderData?.itemsBelowReorder ?? []}
                  columns={[
                    { header: 'Item', accessorKey: 'itemName' },
                    { header: 'SKU', accessorKey: 'sku' },
                    { header: 'On Hand', accessorKey: 'onHand' },
                    { header: 'Reorder Level', accessorKey: 'reorderLevel' },
                    { header: 'Shortfall', accessorKey: 'shortfall' },
                  ]}
                />
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
