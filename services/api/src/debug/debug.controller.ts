import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../me/user.decorator';
import { DebugService } from './debug.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

export interface DemoHealthResponse {
  timestamp: string;
  orgId: string;
  orgName: string;
  activeBranchId: string | null;
  branchCount: number;
  branchIds: string[];
  branches: Array<{ id: string; name: string }>;
  orders: {
    total: number;
    byStatus: Record<string, number>;
    earliestCreatedAt: string | null;
    latestCreatedAt: string | null;
    inDateRange: number;
  };
  orderItems: {
    count: number;
  };
  payments: {
    count: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
  };
  feedback: {
    count: number;
    avgScore: number | null;
  };
  inventory: {
    itemCount: number;
    lowCount: number;
    criticalCount: number;
  };
  menu: {
    itemCount: number;
    categoriesCount: number;
  };
  serviceProviders: {
    count: number;
  };
  reservations: {
    count: number;
  };
  anomalies: {
    count: number;
    bySeverity: Record<string, number>;
  };
  shifts: {
    count: number;
    openCount: number;
  };
  users: {
    count: number;
    byRole: Record<string, number>;
  };
  perBranch?: Array<{
    branchId: string;
    branchName: string;
    orders: number;
    orderItems: number;
    payments: number;
  }>;
  diagnostics: {
    userBranchId: string | null;
    userBranchValid: boolean;
    dateRangeUsed: { from: string; to: string };
    warnings: string[];
  };
}

@ApiTags('Debug')
@ApiBearerAuth('bearer')
@Controller('debug')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DebugController {
  constructor(private debugService: DebugService) {}

  /**
   * GET /debug/demo-health
   * Returns comprehensive health check of demo data for the authenticated user's org.
   * Useful for diagnosing why dashboards/analytics show empty.
   * 
   * RBAC: L4+ (Manager, Owner, Accountant)
   */
  @Get('demo-health')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  @ApiOperation({
    summary: 'Demo data health check',
    description: 'Returns counts and diagnostics for all demo data in the org',
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Optional branch filter' })
  async getDemoHealth(
    @User() user: { userId: string; orgId: string; branchId: string | null },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ): Promise<DemoHealthResponse> {
    // Default date range: last 30 days
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    return this.debugService.getDemoHealth(
      user.orgId,
      user.branchId,
      branchId || null,
      fromDate,
      toDate,
    );
  }
}
