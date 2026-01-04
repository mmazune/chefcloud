/**
 * M10.7: Payslips Admin Page
 * 
 * List and view payslips for all employees (admin view).
 * RBAC: L4+ (Manager/Accountant/Owner)
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';
import { FileText, Search, User } from 'lucide-react';
import Link from 'next/link';

interface Payslip {
  id: string;
  userId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossEarnings: string;
  netPay: string;
  taxesWithheld: string;
  totalEmployerCost: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  payrollRun: {
    id: string;
    status: string;
    branchId?: string;
  };
  payrollRunLine: {
    regularHours: string;
    overtimeHours: string;
    paidHours: string;
  };
}

interface Branch {
  id: string;
  name: string;
}

export default function PayslipsPage() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Check role access
  const canView = user?.roleLevel === 'L4' || user?.roleLevel === 'L5';

  useEffect(() => {
    if (!canView) return;
    fetchData();
  }, [canView]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payslipsRes, branchesRes] = await Promise.all([
        apiClient.get('/workforce/payslips'),
        apiClient.get('/branches'),
      ]);
      setPayslips(payslipsRes.data);
      setBranches(branchesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  // Filter payslips
  const filteredPayslips = payslips.filter((p) => {
    if (branchFilter && p.payrollRun.branchId !== branchFilter) return false;
    if (employeeSearch) {
      const searchLower = employeeSearch.toLowerCase();
      const fullName = `${p.user.firstName} ${p.user.lastName}`.toLowerCase();
      if (!fullName.includes(searchLower) && !p.user.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  if (!canView) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          You don&apos;t have permission to view this page.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payslips</h1>
            <p className="text-muted-foreground">View and manage employee payslips</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="w-48">
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  className="pl-9"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payslips Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Payslips</CardTitle>
            <CardDescription>
              {filteredPayslips.length} payslip{filteredPayslips.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">{error}</div>
            ) : filteredPayslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payslips found. Generate payslips from a calculated payroll run.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay Period</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Taxes</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {payslip.user.firstName} {payslip.user.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payslip.user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(payslip.payPeriodStart), 'MMM d')} -{' '}
                        {format(new Date(payslip.payPeriodEnd), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(payslip.payrollRunLine.paidHours).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {parseFloat(payslip.grossEarnings).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {parseFloat(payslip.taxesWithheld).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {parseFloat(payslip.netPay).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/workforce/payslips/${payslip.id}`}>
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
                            View
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
      </div>
    </AppShell>
  );
}
