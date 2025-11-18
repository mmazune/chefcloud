import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReconciliationService, ReconciliationQuery } from './reconciliation.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';
import { Req } from '@nestjs/common';

@Controller('inventory/reconciliation')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * Get inventory reconciliation for a branch and period
   * RBAC: OWNER, MANAGER, ACCOUNTANT, FRANCHISE
   */
  @Get()
  @Roles('L4', 'L5', 'ACCOUNTANT', 'FRANCHISE')
  async getReconciliation(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId: string,
    @Query('shiftId') shiftId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query: ReconciliationQuery = {
      orgId: req.user.orgId,
      branchId,
      shiftId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const results = await this.reconciliationService.reconcile(query);
    const summary = await this.reconciliationService.getSummary(query);

    return {
      summary,
      items: results,
    };
  }

  /**
   * Get reconciliation summary only (for dashboards)
   */
  @Get('summary')
  @Roles('L4', 'L5', 'ACCOUNTANT', 'FRANCHISE')
  async getSummary(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId: string,
    @Query('shiftId') shiftId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query: ReconciliationQuery = {
      orgId: req.user.orgId,
      branchId,
      shiftId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.reconciliationService.getSummary(query);
  }
}
