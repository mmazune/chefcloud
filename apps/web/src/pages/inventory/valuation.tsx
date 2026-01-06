/**
 * M11.5: Inventory Valuation Page
 * 
 * Displays on-hand value at WAC (Weighted Average Cost).
 * Features:
 * - View valuation by item with on-hand qty × WAC
 * - Category filter
 * - Include/exclude zero stock toggle
 * - Export to CSV with UTF-8 BOM + hash
 * - L4+ RBAC required (Manager, Owner, Admin)
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { Search, Download, RefreshCw, DollarSign, Package, Layers } from 'lucide-react';

interface ValuationLine {
    itemId: string;
    itemCode: string;
    itemName: string;
    categoryName?: string;
    onHandQty: number;
    wac: number;
    totalValue: number;
    lastCostLayerAt?: string;
}

interface ValuationSummary {
    branchId: string;
    branchName: string;
    lines: ValuationLine[];
    totalValue: number;
    itemCount: number;
    asOfDate: string;
}

interface Category {
    id: string;
    name: string;
}

export default function ValuationPage() {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [includeZeroStock, setIncludeZeroStock] = useState(false);

    // Fetch categories for filter
    const { data: categories } = useQuery({
        queryKey: ['inventory-categories'],
        queryFn: async () => {
            const response = await apiClient.get<Category[]>('/inventory/categories');
            return response.data ?? [];
        },
    });

    // Fetch valuation data
    const { data: valuationData, isLoading, refetch } = useQuery({
        queryKey: ['inventory-valuation', selectedCategory, includeZeroStock],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (selectedCategory) {
                params.categoryId = selectedCategory;
            }
            if (includeZeroStock) {
                params.includeZeroStock = 'true';
            }
            const response = await apiClient.get<{ success: boolean; data: ValuationSummary }>(
                '/inventory/valuation',
                { params }
            );
            return response.data.data;
        },
    });

    // Handle CSV export
    const handleExport = async () => {
        try {
            const params: Record<string, string> = {};
            if (selectedCategory) {
                params.categoryId = selectedCategory;
            }
            if (includeZeroStock) {
                params.includeZeroStock = 'true';
            }

            const response = await apiClient.get('/inventory/valuation/export', {
                params,
                responseType: 'blob',
            });

            // Log the export hash from header
            const exportHash = response.headers['x-nimbus-export-hash'];
            if (exportHash) {
                console.log('Export Hash:', exportHash);
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `valuation-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    // Filter valuation data
    const filteredData = React.useMemo(() => {
        if (!valuationData?.lines) return [];
        if (!search) return valuationData.lines;

        const searchLower = search.toLowerCase();
        return valuationData.lines.filter(
            (item) =>
                item.itemName.toLowerCase().includes(searchLower) ||
                item.itemCode.toLowerCase().includes(searchLower) ||
                item.categoryName?.toLowerCase().includes(searchLower)
        );
    }, [valuationData?.lines, search]);

    // Summary stats
    const stats = React.useMemo(() => {
        if (!valuationData)
            return { totalValue: 0, itemCount: 0, avgValue: 0 };
        const totalValue = filteredData.reduce((sum, d) => sum + d.totalValue, 0);
        return {
            totalValue,
            itemCount: filteredData.length,
            avgValue: filteredData.length > 0 ? totalValue / filteredData.length : 0,
        };
    }, [valuationData, filteredData]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatQty = (value: number) => {
        return value.toFixed(4);
    };

    const columns = [
        {
            header: 'Item',
            accessor: (row: ValuationLine) => (
                <div>
                    <div className="font-medium">{row.itemName}</div>
                    <div className="text-sm text-gray-500">{row.itemCode}</div>
                </div>
            ),
        },
        {
            header: 'Category',
            accessor: (row: ValuationLine) => row.categoryName ?? '-',
        },
        {
            header: 'On Hand',
            accessor: (row: ValuationLine) => (
                <div className="font-mono text-right">
                    <span className={row.onHandQty <= 0 ? 'text-red-600' : ''}>
                        {formatQty(row.onHandQty)}
                    </span>
                </div>
            ),
        },
        {
            header: 'WAC',
            accessor: (row: ValuationLine) => (
                <div className="font-mono text-right">{formatCurrency(row.wac)}</div>
            ),
        },
        {
            header: 'Total Value',
            accessor: (row: ValuationLine) => (
                <div className="font-mono text-right font-semibold">
                    <span className={row.totalValue <= 0 ? 'text-gray-400' : 'text-green-600'}>
                        {formatCurrency(row.totalValue)}
                    </span>
                </div>
            ),
        },
        {
            header: 'Last Cost Update',
            accessor: (row: ValuationLine) =>
                row.lastCostLayerAt
                    ? new Date(row.lastCostLayerAt).toLocaleDateString()
                    : '-',
        },
    ];

    return (
        <AppShell>
            <div className="flex flex-col gap-6 p-6">
                <PageHeader
                    title="Inventory Valuation"
                    subtitle="On-hand value at Weighted Average Cost (WAC)"
                />

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Total Value</div>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(stats.totalValue)}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Items with Stock</div>
                                <div className="text-2xl font-bold">{stats.itemCount}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Layers className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Avg. Item Value</div>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(stats.avgValue)}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px] max-w-[400px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search items..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="w-[200px]">
                            <Select
                                value={selectedCategory}
                                onValueChange={setSelectedCategory}
                                placeholder="All Categories"
                            >
                                <Select.Option value="">All Categories</Select.Option>
                                {categories?.map((cat) => (
                                    <Select.Option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                checked={includeZeroStock}
                                onCheckedChange={setIncludeZeroStock}
                                id="include-zero"
                            />
                            <label htmlFor="include-zero" className="text-sm">
                                Include zero stock
                            </label>
                        </div>

                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" onClick={() => refetch()}>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Refresh
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="h-4 w-4 mr-1" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Valuation Table */}
                <Card>
                    <DataTable
                        columns={columns}
                        data={filteredData}
                        isLoading={isLoading}
                        emptyMessage="No valuation data available"
                    />
                </Card>

                {/* Footer with as-of timestamp */}
                {valuationData && (
                    <div className="text-sm text-gray-500 text-right">
                        As of: {new Date(valuationData.asOfDate).toLocaleString()} | Branch:{' '}
                        {valuationData.branchName}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
