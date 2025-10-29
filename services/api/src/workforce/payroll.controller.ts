/**
 * E43-s2: Payroll Controller
 * 
 * REST endpoints for payroll runs, payslips, and pay components (L4+ only).
 */

import { Controller, Post, Patch, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('L4', 'L5') // Manager/Accountant+ only
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * POST /payroll/runs
   * Create draft pay run for period
   */
  @Post('runs')
  async createRun(
    @Body() body: { orgId: string; periodStart: string; periodEnd: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Request() req: any,
  ) {
    return this.payrollService.buildDraftRun(
      body.orgId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      req.user.id,
    );
  }

  /**
   * PATCH /payroll/runs/:id/approve
   * Approve draft pay run
   */
  @Patch('runs/:id/approve')
  async approveRun(
    @Param('id') id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Request() req: any,
  ) {
    return this.payrollService.approveRun(id, req.user.id);
  }

  /**
   * POST /payroll/runs/:id/post
   * Post pay run to GL (creates journal entry)
   */
  @Post('runs/:id/post')
  async postRun(
    @Param('id') id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Request() req: any,
  ) {
    return this.payrollService.postToGL(id, req.user.id);
  }

  /**
   * GET /payroll/runs/:id/slips
   * Get payslips for a pay run
   */
  @Get('runs/:id/slips')
  async getSlips(@Param('id') id: string) {
    return this.payrollService.getSlips(id);
  }

  /**
   * POST /payroll/components
   * Upsert pay component (earning or deduction)
   */
  @Post('components')
  async upsertComponent(
    @Body()
    body: {
      id?: string;
      orgId: string;
      name: string;
      type: 'EARNING' | 'DEDUCTION';
      calc: 'FIXED' | 'RATE' | 'PERCENT';
      value: number;
      taxable?: boolean;
      active?: boolean;
    },
  ) {
    return this.payrollService.upsertComponent(body);
  }
}
