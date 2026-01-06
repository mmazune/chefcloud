/**
 * M8.6: Vendors Page
 * 
 * List and manage vendors with associated bills and credit notes.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Search,
  FileText,
  Eye,
  Plus,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  _count?: {
    bills: number;
    creditNotes: number;
  };
  totalOutstanding?: number;
}

export default function VendorsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiClient.get<Vendor[]>('/accounting/vendors');
      return response.data;
    },
    enabled: !!user,
  });

  // Filter vendors by search term
  const filteredVendors = vendors?.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Compute stats
  const stats = {
    total: vendors?.length || 0,
    active: vendors?.filter(v => v.isActive).length || 0,
    withBills: vendors?.filter(v => (v._count?.bills || 0) > 0).length || 0,
    totalOutstanding: vendors?.reduce((sum, v) => sum + (v.totalOutstanding || 0), 0) || 0,
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader
          title="Vendors"
          subtitle="Manage vendor accounts and payables"
          actions={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Vendors</p>
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
              <p className="text-sm text-muted-foreground">With Open Bills</p>
              <p className="text-2xl font-bold text-blue-600">{stats.withBills}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Vendors Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Vendors ({filteredVendors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No vendors found</p>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search' : 'Add your first vendor to get started'}
                </p>
                {!searchTerm && (
                  <Button className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Credit Notes</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map(vendor => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        {vendor.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          {vendor.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {vendor.email}
                            </span>
                          )}
                          {vendor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {vendor.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
                          {vendor.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {vendor._count?.bills || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {vendor._count?.creditNotes || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {vendor.totalOutstanding
                          ? formatCurrency(vendor.totalOutstanding)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Link href={`/finance/vendors/${vendor.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
