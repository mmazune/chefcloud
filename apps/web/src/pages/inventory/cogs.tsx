/**
 * M11.5: Cost of Goods Sold (COGS) Page
 * 
 * Displays COGS for a date range based on inventory depletions.
 * Features:
 * - Date range picker (from/to)
 * - COGS breakdown by depleted item
 * - Category filter
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
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { apiClient } from '@/lib/api';
import { Search, Download, RefreshCw, TrendingDown, Receipt, Calendar } from 'lucide-react';

interface CogsLine {
    depletionId: string;
    orderId: string;
    orderNumber?: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    qtyDepleted: number;
    unitCost: number;
    lineCogs: number;
    depletedAt: string;
}

interface CogsSummary {
    branchId: string;
    branchName: string;
    fromDate: string;
    toDate: string;
    lines: CogsLine[];
    totalCogs: number;
    lineCount: number;
}

interface Category {
    id: string;
    name: string;
}

export default function CogsPage() {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    // Default date range: last 7 days
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [fromDate, setFromDate] = useState<Date>(weekAgo);
    const [toDate, setToDate] = useState<Date>(today);

    // Fetch categories for filter
    const { data: categories } = useQuery({
        queryKey: ['inventory-categories'],
        queryFn: async () => {
            const response = await apiClient.get<Category[]>('/inventory/categories');
            return response.data ?? [];
        },
    });

    // Fetch COGS data
    const { data: cogsData, isLoading, refetch } = useQuery({
        queryKey: ['inventory-cogs', fromDate, toDate, selectedCategory],
        queryFn: async () => {
            const params: Record<string, string> = {
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString(),
            };
            if (selectedCategory) {
                params.categoryId = selectedCategory;
            }
            const response = await apiClient.get<{ success: boolean; data: CogsSummary }>(
                '/inventory/cogs',
                { params }
            );
            return response.data.data;
        },
        enabled: !!fromDate && !!toDate,
    });

    // Handle CSV export
    const handleExport = async () => {
        try {
            const params: Record<string, string> = {
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString(),
            };
            if (selectedCategory) {
                params.categoryId = selectedCategory;
            }

            const response = await apiClient.get('/inventory/cogs/export', {
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
            const fromStr = fromDate.toISOString().split('T')[0];
            const toStr = toDate.toISOString().split('T')[0];
            link.setAttribute('download', `cogs-${fromStr}-to-${toStr}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    // Filter COGS data
    const filteredData = React.useMemo(() => {
        if (!cogsData?.lines) return [];
        if (!search) return cogsData.lines;

        const searchLower = search.toLowerCase();
        return cogsData.lines.filter(
            (item) =>
                item.itemName.toLowerCase().includes(searchLower) ||
                item.itemCode.toLowerCase().includes(searchLower) ||
                item.orderId.toLowerCase().includes(searchLower)
        );
    }, [cogsData?.lines, search]);

    // Summary stats
    const stats = React.useMemo(() => {
        if (!cogsData) return { totalCogs: 0, lineCount: 0, avgPerOrder: 0 };

        // Calculate unique orders
        const orderIds = new Set(filteredData.map((d) => d.orderId));
        const avgPerOrder = orderIds.size > 0 ? cogsData.totalCogs / orderIds.size : 0;

        return {
            totalCogs: cogsData.totalCogs,
            lineCount: filteredData.length,
            avgPerOrder,
            uniqueOrders: orderIds.size,
        };
    }, [cogsData, filteredData]);

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
            header: 'Date',
            accessor: (row: CogsLine) => (
                <div className="text-sm">
                    {new Date(row.depletedAt).toLocaleDateString()}
                    <div className="text-xs text-gray-500">
                        {new Date(row.depletedAt).toLocaleTimeString()}
                    </div>
                </div>
            ),
        },
        {
            header: 'Order',
            accessor: (row: CogsLine) => (
                <div className="font-mono text-sm">
                    {row.orderNumber ?? row.orderId.slice(0, 8)}
                </div>
            ),
        },
        {
            header: 'Item',
            accessor: (row: CogsLine) => (
                <div>
                    <div className="font-medium">{row.itemName}</div>
                    <div className="text-sm text-gray-500">{row.itemCode}</div>
                </div>
            ),
        },
        {
            header: 'Qty',
            accessor: (row: CogsLine) => (
                <div className="font-mono text-right">{formatQty(row.qtyDepleted)}</div>
            ),
        },
        {
            header: 'Unit Cost',
            accessor: (row: CogsLine) => (
                <div className="font-mono text-right">{formatCurrency(row.unitCost)}</div>
            ),
        },
        {
            header: 'Line COGS',
            accessor: (row: CogsLine) => (
                <div className="font-mono text-right font-semibold text-red-600">
                    {formatCurrency(row.lineCogs)}
                </div>
            ),
        },
    ];

    return (
        <AppShell>
            <div className="flex flex-col gap-6 p-6">
                <PageHeader
                    title="Cost of Goods Sold"
                    subtitle="COGS calculated from order depletions at WAC"
                />

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Total COGS</div>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(stats.totalCogs)}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Receipt className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Orders</div>
                                <div className="text-2xl font-bold">{stats.uniqueOrders ?? 0}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Calendar className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Avg. COGS/Order</div>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(stats.avgPerOrder)}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">From:</label>
                            <DatePicker
                                selected={fromDate}
                                onSelect={(date) => date && setFromDate(date)}
                                className="w-[140px]"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">To:</label>
                            <DatePicker
                                selected={toDate}
                                onSelect={(date) => date && setToDate(date)}
                                className="w-[140px]"
                            />
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

                        <div className="flex-1 min-w-[200px] max-w-[300px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search items or orders..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
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

                {/* COGS Table */}
                <Card>
                    <DataTable
                        columns={columns}
                        data={filteredData}
                        isLoading={isLoading}
                        emptyMessage="No COGS data for selected period"
                    />
                </Card>

                {/* Footer */}
                {cogsData && (
                    <div className="text-sm text-gray-500 text-right">
                        Period: {new Date(cogsData.fromDate).toLocaleDateString()} -{' '}
                        {new Date(cogsData.toDate).toLocaleDateString()} | Branch: {cogsData.branchName}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
