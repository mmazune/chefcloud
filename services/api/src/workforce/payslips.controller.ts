/**
 * M10.7: Payslips Controller
 * 
 * Endpoints for viewing payslips.
 * RBAC: L4+ for admin views, L1+ for self-service.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PayslipService } from './payslip.service';

@Controller('workforce')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayslipsController {
  constructor(private readonly payslipService: PayslipService) { }

  // ==================== ADMIN ENDPOINTS (L4+) ====================

  /**
   * List all payslips with filters (admin)
   */
  @Get('payslips')
  @Roles('L4', 'L5')
  async listPayslips(
    @Request() req: any,
    @Query('payrollRunId') payrollRunId?: string,
    @Query('userId') userId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.payslipService.listPayslips(req.user.orgId, {
      payrollRunId,
      userId,
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get a single payslip by ID (admin or owner)
   */
  @Get('payslips/:id')
  @Roles('L3', 'L4', 'L5')
  async getPayslip(@Request() req: any, @Param('id') id: string) {
    // L4+ = admin, L3 = can view if own
    const isAdmin = ['L4', 'L5'].includes(req.user.roleLevel);
    return this.payslipService.getPayslip(
      req.user.orgId,
      id,
      req.user.userId,
      isAdmin,
    );
  }

  /**
   * List payslips for a specific payroll run (admin)
   */
  @Get('payroll-runs/:runId/payslips')
  @Roles('L4', 'L5')
  async listPayslipsForRun(@Request() req: any, @Param('runId') runId: string) {
    return this.payslipService.listPayslipsForRun(req.user.orgId, runId);
  }

  /**
   * Get payslip summary statistics for a run
   */
  @Get('payroll-runs/:runId/payslips/summary')
  @Roles('L4', 'L5')
  async getPayslipSummary(@Request() req: any, @Param('runId') runId: string) {
    return this.payslipService.getPayslipSummaryForRun(req.user.orgId, runId);
  }

  // ==================== SELF-SERVICE ENDPOINTS (L1+) ====================

  /**
   * List my payslips (employee self-service)
   */
  @Get('me/payslips')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async listMyPayslips(@Request() req: any) {
    // Always use req.user.userId - no override allowed
    return this.payslipService.listMyPayslips(req.user.orgId, req.user.userId);
  }

  /**
   * Get my payslip by ID (employee self-service)
   */
  @Get('me/payslips/:id')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyPayslip(@Request() req: any, @Param('id') id: string) {
    // Force isAdmin = false, enforce userId filter
    return this.payslipService.getPayslip(
      req.user.orgId,
      id,
      req.user.userId,
      false, // Not admin - must be own payslip
    );
  }
}
