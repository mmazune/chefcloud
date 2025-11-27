import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserX, Clock, DollarSign, Award, TrendingUp } from 'lucide-react';

// Types matching backend
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEFT_EARLY' | 'COVERED';
type PayrollStatus = 'DRAFT' | 'FINALIZED' | 'PAID';
type PromotionCategory = 'PROMOTION' | 'TRAINING' | 'PERFORMANCE_REVIEW';
type PromotionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IGNORED';

interface AttendanceSummary {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
  notes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
  };
  dutyShift?: {
    id: string;
    name: string;
  };
}

interface PayrollRun {
  id: string;
  orgId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  totalGross: number;
  totalNet: number;
  createdAt: string;
  slipCount?: number;
}

interface StaffAward {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  category: string;
  notes: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    position: string | null;
  };
}

interface PromotionSuggestion {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  category: PromotionCategory;
  scoreAtSuggestion: number;
  reason: string | null;
  status: PromotionStatus;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    position: string | null;
  };
  branch?: {
    name: string;
  };
}

interface PromotionSuggestionsResponse {
  suggestions: PromotionSuggestion[];
  total: number;
}

interface AwardsResponse {
  awards: StaffAward[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function HRPage() {
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');

  // TODO: Get from user context
  const branchId = 'branch-1';
  const orgId = 'org-1';

  // Calculate date range for last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  // Fetch attendance summary (today)
  const { data: attendanceSummary } = useQuery<AttendanceSummary>({
    queryKey: ['attendance-summary', orgId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams({ orgId });
      if (branchId) params.append('branchId', branchId);
      
      const res = await fetch(`${API_URL}/hr/attendance/today-summary?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch attendance summary');
      return res.json();
    },
  });

  // Fetch recent attendance records
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-records', orgId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams({ orgId });
      if (branchId) params.append('branchId', branchId);
      params.append('dateFrom', sevenDaysAgo.toISOString().split('T')[0]);
      params.append('dateTo', today.toISOString().split('T')[0]);
      
      const res = await fetch(`${API_URL}/hr/attendance?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch attendance records');
      return res.json();
    },
  });

  // Fetch payroll runs
  const { data: payrollRuns = [], isLoading: payrollLoading } = useQuery<PayrollRun[]>({
    queryKey: ['payroll-runs', orgId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams({ orgId });
      if (branchId) params.append('branchId', branchId);
      params.append('limit', '5');
      
      const res = await fetch(`${API_URL}/payroll/runs?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch payroll runs');
      return res.json();
    },
  });

  // Fetch staff awards
  const { data: awardsData } = useQuery<AwardsResponse>({
    queryKey: ['staff-awards', orgId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      params.append('limit', '5');
      
      const res = await fetch(`${API_URL}/staff/insights/awards?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch staff awards');
      return res.json();
    },
  });

  // Fetch promotion suggestions
  const { data: promotionsData } = useQuery<PromotionSuggestionsResponse>({
    queryKey: ['promotion-suggestions', orgId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      params.append('status', 'PENDING');
      params.append('limit', '5');
      
      const res = await fetch(`${API_URL}/staff/promotion-suggestions?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch promotion suggestions');
      return res.json();
    },
  });

  const awards = awardsData?.awards || [];
  const promotions = promotionsData?.suggestions || [];

  // Filter attendance records
  const filteredRecords = useMemo(() => {
    if (statusFilter === 'ALL') return attendanceRecords;
    return attendanceRecords.filter((r) => r.status === statusFilter);
  }, [attendanceRecords, statusFilter]);

  // Calculate payroll this month
  const payrollThisMonth = useMemo(() => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlyRuns = payrollRuns.filter((run) => {
      const runDate = new Date(run.periodEnd);
      return runDate >= thisMonth;
    });

    return monthlyRuns.reduce((sum, run) => sum + run.totalNet, 0);
  }, [payrollRuns]);

  // Helper functions
  const getStatusBadgeColor = (status: AttendanceStatus): string => {
    const colors: Record<AttendanceStatus, string> = {
      PRESENT: 'bg-green-100 text-green-800',
      ABSENT: 'bg-red-100 text-red-800',
      LATE: 'bg-orange-100 text-orange-800',
      LEFT_EARLY: 'bg-amber-100 text-amber-800',
      COVERED: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPayrollStatusBadgeColor = (status: PayrollStatus): string => {
    const colors: Record<PayrollStatus, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      FINALIZED: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryBadgeColor = (category: PromotionCategory): string => {
    const colors: Record<PromotionCategory, string> = {
      PROMOTION: 'bg-purple-100 text-purple-800',
      TRAINING: 'bg-blue-100 text-blue-800',
      PERFORMANCE_REVIEW: 'bg-orange-100 text-orange-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category: PromotionCategory): string => {
    const labels: Record<PromotionCategory, string> = {
      PROMOTION: 'Promotion',
      TRAINING: 'Training',
      PERFORMANCE_REVIEW: 'Performance Review',
    };
    return labels[category] || category;
  };

  const getAwardLabel = (category: string): string => {
    const labels: Record<string, string> = {
      TOP_PERFORMER: 'Top Performer',
      MOST_RELIABLE: 'Most Reliable',
      BEST_ATTENDANCE: 'Best Attendance',
      EMPLOYEE_OF_THE_MONTH: 'Employee of the Month',
    };
    return labels[category] || category;
  };

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <AppShell>
      <PageHeader
        title="HR & Workforce"
        subtitle="Monitor headcount, attendance, payroll and staff recognition."
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold">{attendanceSummary?.totalEmployees || 0}</p>
              <p className="text-xs text-gray-500">active employees</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Present Today</p>
              <p className="text-2xl font-bold">{attendanceSummary?.presentToday || 0}</p>
              <p className="text-xs text-gray-500">
                {attendanceSummary?.totalEmployees 
                  ? `${Math.round((attendanceSummary.presentToday / attendanceSummary.totalEmployees) * 100)}% attendance`
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Absent/Late Today</p>
              <p className="text-2xl font-bold">
                {(attendanceSummary?.absentToday || 0) + (attendanceSummary?.lateToday || 0)}
              </p>
              <p className="text-xs text-gray-500">
                {attendanceSummary?.absentToday || 0} absent, {attendanceSummary?.lateToday || 0} late
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Payroll This Month</p>
              <p className="text-2xl font-bold">
                {payrollThisMonth > 0 ? formatCurrency(payrollThisMonth) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">net payroll cost</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        {/* Attendance Table (2 columns) */}
        <Card className="md:col-span-2 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">Attendance</h3>
              <p className="text-sm text-gray-500">Last 7 days</p>
            </div>
            <div className="flex gap-2">
              {(['ALL', 'PRESENT', 'ABSENT', 'LATE'] as const).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          </div>

          {attendanceLoading ? (
            <div className="text-center py-8 text-gray-500">Loading attendance...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Employee</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Shift</th>
                    <th className="pb-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredRecords.slice(0, 20).map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-600">
                        {formatDate(record.date)}
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <span className="font-medium">
                            {record.employee.firstName} {record.employee.lastName}
                          </span>
                          {record.employee.employeeCode && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({record.employee.employeeCode})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={getStatusBadgeColor(record.status)}>
                          {record.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {record.dutyShift?.name || '—'}
                      </td>
                      <td className="py-3 text-gray-600 text-xs">
                        {record.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Payroll Runs (1 column) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payroll Runs</h3>

          {payrollLoading ? (
            <div className="text-center py-8 text-gray-500">Loading payroll...</div>
          ) : payrollRuns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No payroll runs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payrollRuns.map((run) => (
                <div
                  key={run.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{formatPeriod(run.periodStart, run.periodEnd)}</p>
                      <p className="text-xs text-gray-500">
                        {run.slipCount || 0} payslips
                      </p>
                    </div>
                    <Badge className={getPayrollStatusBadgeColor(run.status)}>
                      {run.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Net Total:</span>
                    <span className="font-semibold">{formatCurrency(run.totalNet)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Created {formatDate(run.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Section: Awards & Promotions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Staff Awards */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold">Staff Awards</h3>
          </div>

          {awards.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Award className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No awards yet</p>
              <p className="text-sm">Awards will appear here once granted</p>
            </div>
          ) : (
            <div className="space-y-3">
              {awards.map((award) => (
                <div
                  key={award.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">
                        {award.employee.firstName} {award.employee.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{award.employee.position || 'Staff'}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {getAwardLabel(award.category)}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Period: {formatPeriod(award.periodStart, award.periodEnd)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Awarded {formatDate(award.createdAt)}
                    </p>
                  </div>
                  {award.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">{award.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Promotion Suggestions */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Promotion Suggestions</h3>
          </div>

          {promotions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No pending suggestions</p>
              <p className="text-sm">Promotion suggestions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">
                        {suggestion.employee.firstName} {suggestion.employee.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {suggestion.employee.position || 'Staff'}
                      </p>
                    </div>
                    <Badge className={getCategoryBadgeColor(suggestion.category)}>
                      {getCategoryLabel(suggestion.category)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-600">Score:</span>
                    <span className="font-semibold">
                      {Math.round(suggestion.scoreAtSuggestion * 100)}%
                    </span>
                  </div>
                  {suggestion.reason && (
                    <p className="text-xs text-gray-600 mb-2">{suggestion.reason}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Suggested {formatDate(suggestion.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
