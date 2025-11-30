import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { EmployeeForm } from '@/components/staff/EmployeeForm';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import { registerPosServiceWorker } from '@/lib/registerPosServiceWorker';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useStaffCachedOverview } from '@/hooks/useStaffCachedOverview';

// M27-S5: Extended with offline-first caching

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  position: string | null;
  branchId: string | null;
  roleLevel: string | null;
  salaryType: string | null;
  baseSalaryAmount: number | null;
  isActive: boolean;
  hiredAt: string;
  createdAt: string;
}

interface EmployeeListResponse {
  items: Employee[];
  page: number;
  pageSize: number;
  total: number;
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // M27-S5: Register service worker for offline support
  useEffect(() => {
    registerPosServiceWorker();
  }, []);

  // M27-S5: Online status and cached staff overview
  const isOnline = useOnlineStatus();
  const {
    source: cacheSource,
    isStale: cacheIsStale,
  } = useStaffCachedOverview();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, isActiveFilter],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (search) params.search = search;
      if (isActiveFilter !== undefined) params.isActive = isActiveFilter;

      const response = await apiClient.get<EmployeeListResponse>('/hr/employees', { params });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/hr/employees', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDrawerOpen(false);
      setEditingEmployee(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/hr/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDrawerOpen(false);
      setEditingEmployee(null);
    },
  });

  const handleCreate = () => {
    setEditingEmployee(null);
    setDrawerOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDrawerOpen(true);
  };

  const handleSubmit = async (formData: any) => {
    if (editingEmployee) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const columns = [
    {
      header: 'Employee Code',
      accessor: 'employeeCode' as keyof Employee,
    },
    {
      header: 'Name',
      accessor: (row: Employee) => `${row.firstName} ${row.lastName}`,
    },
    {
      header: 'Email',
      accessor: (row: Employee) => row.email || '—',
    },
    {
      header: 'Position',
      accessor: (row: Employee) => row.position || '—',
    },
    {
      header: 'Salary',
      accessor: (row: Employee) => {
        if (!row.salaryType || !row.baseSalaryAmount) return '—';
        return (
          <div className="text-sm">
            <div className="font-medium">{formatCurrency(row.baseSalaryAmount)}</div>
            <div className="text-muted-foreground">{row.salaryType}</div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: (row: Employee) => (
        <Badge variant={row.isActive ? 'success' : 'destructive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Hired',
      accessor: (row: Employee) => formatDate(row.hiredAt),
    },
    {
      header: 'Actions',
      accessor: (row: Employee) => (
        <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      {/* M27-S5: Offline/stale banners */}
      {!isOnline && cacheSource !== 'none' && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 text-xs text-amber-900">
          Viewing last-known staff metrics from this device.
          {cacheIsStale && (
            <span className="ml-2 font-semibold">
              Note: data is older than your freshness window; connect soon to refresh.
            </span>
          )}
        </div>
      )}

      {!isOnline && cacheSource === 'none' && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-1 text-xs text-red-900">
          No cached staff overview available. Connect at least once to enable offline staff view.
        </div>
      )}

      {isOnline && cacheIsStale && cacheSource !== 'none' && (
        <div className="bg-orange-50 border-b border-orange-200 px-3 py-1 text-xs text-orange-900">
          Staff snapshot is stale. A fresh version will load when the server is reachable.
        </div>
      )}

      <PageHeader
        title="Staff Management"
        subtitle="Manage employees, contracts, and HR information"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-medium mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by name, email, or employee code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <div className="flex gap-2">
            <Button
              variant={isActiveFilter === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsActiveFilter(undefined)}
            >
              All
            </Button>
            <Button
              variant={isActiveFilter === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsActiveFilter(true)}
            >
              Active
            </Button>
            <Button
              variant={isActiveFilter === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsActiveFilter(false)}
            >
              Inactive
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading && <p className="text-center py-8 text-muted-foreground">Loading employees...</p>}
      
      {!isLoading && data && (
        <>
          <DataTable
            data={data.items}
            columns={columns}
            emptyMessage="No employees found. Click 'Add Employee' to create one."
          />

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {(data.page - 1) * data.pageSize + 1} to{' '}
              {Math.min(data.page * data.pageSize, data.total)} of {data.total} employees
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.pageSize >= data.total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 text-sm text-muted-foreground">
        ✓ Connected to backend: GET /hr/employees
      </div>

      {/* Create/Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingEmployee(null);
        }}
        title={editingEmployee ? 'Edit Employee' : 'Create Employee'}
        size="md"
      >
        <EmployeeForm
          initialData={editingEmployee ? {
            firstName: editingEmployee.firstName,
            lastName: editingEmployee.lastName,
            branchId: editingEmployee.branchId || '',
            email: editingEmployee.email || undefined,
            position: editingEmployee.position || undefined,
            salaryType: editingEmployee.salaryType as any || undefined,
            baseSalaryAmount: editingEmployee.baseSalaryAmount || undefined,
            isActive: editingEmployee.isActive,
          } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setDrawerOpen(false);
            setEditingEmployee(null);
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </Drawer>
    </AppShell>
  );
}
