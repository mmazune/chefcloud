/**
 * M10.6: Payroll Runs Controller
 * 
 * REST endpoints for payroll run management.
 * RBAC: L3=view, L4=create/calc/approve, L5=post/pay/void
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PayrollRunService, CreatePayrollRunDto, PayrollRunStatus } from './payroll-run.service';
import { PayrollPostingService, PostPayrollDto, PayPayrollDto } from './payroll-posting.service';
import { PayrollReportingService } from './payroll-reporting.service';
import { PayrollExportService } from './payroll-export.service';
import { PayslipService } from './payslip.service';

@Controller('workforce/payroll-runs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayrollRunsController {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly payrollPostingService: PayrollPostingService,
    private readonly payrollReportingService: PayrollReportingService,
    private readonly payrollExportService: PayrollExportService,
    private readonly payslipService: PayslipService,
  ) {}

  // ===== CRUD Endpoints =====

  /**
   * GET /workforce/payroll-runs
   * List payroll runs with filters
   * RBAC: L3+ can view
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async listPayrollRuns(
    @Query('branchId') branchId?: string,
    @Query('payPeriodId') payPeriodId?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.payrollRunService.listPayrollRuns(req.user.orgId, {
      branchId,
      payPeriodId,
      status: status as PayrollRunStatus,
    });
  }

  /**
   * GET /workforce/payroll-runs/:id
   * Get a single payroll run with details
   * RBAC: L3+ can view
   */
  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  async getPayrollRun(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.payrollRunService.getPayrollRun(req.user.orgId, id);
  }

  /**
   * POST /workforce/payroll-runs
   * Create a new payroll run
   * RBAC: L4+ can create
   */
  @Post()
  @Roles('L4', 'L5')
  async createPayrollRun(
    @Body() dto: CreatePayrollRunDto,
    @Request() req: any,
  ) {
    return this.payrollRunService.createPayrollRun(
      req.user.orgId,
      req.user.userId,
      dto,
    );
  }

  // ===== State Transitions =====

  /**
   * POST /workforce/payroll-runs/:id/calculate
   * Calculate payroll run from approved time entries
   * RBAC: L4+ can calculate
   */
  @Post(':id/calculate')
  @Roles('L4', 'L5')
  async calculatePayrollRun(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.payrollRunService.calculatePayrollRun(
      req.user.orgId,
      req.user.userId,
      id,
    );
  }

  /**
   * POST /workforce/payroll-runs/:id/approve
   * Approve a calculated payroll run
   * RBAC: L4+ can approve
   */
  @Post(':id/approve')
  @Roles('L4', 'L5')
  async approvePayrollRun(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.payrollRunService.approvePayrollRun(
      req.user.orgId,
      req.user.userId,
      id,
    );
  }

  /**
   * POST /workforce/payroll-runs/:id/post
   * Post payroll run to GL (creates journal entry)
   * RBAC: L5 only (Owner/Accountant)
   */
  @Post(':id/post')
  @Roles('L5')
  async postPayrollRun(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const dto: PostPayrollDto = { runId: id };
    return this.payrollPostingService.postPayrollRun(
      req.user.orgId,
      req.user.userId,
      dto,
    );
  }

  /**
   * POST /workforce/payroll-runs/:id/pay
   * Mark payroll run as paid (creates payment journal entry)
   * RBAC: L5 only (Owner/Accountant)
   */
  @Post(':id/pay')
  @Roles('L5')
  async payPayrollRun(
    @Param('id') id: string,
    @Body() body: { paymentMethod?: string; bankAccountCode?: string },
    @Request() req: any,
  ) {
    const dto: PayPayrollDto = { 
      runId: id, 
      paymentMethod: body.paymentMethod,
      bankAccountCode: body.bankAccountCode,
    };
    return this.payrollPostingService.payPayrollRun(
      req.user.orgId,
      req.user.userId,
      dto,
    );
  }

  /**
   * POST /workforce/payroll-runs/:id/void
   * Void a payroll run (creates reversal journal entries)
   * RBAC: L5 only (Owner)
   */
  @Post(':id/void')
  @Roles('L5')
  async voidPayrollRun(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.payrollPostingService.voidPayrollRun(
      req.user.orgId,
      req.user.userId,
      id,
    );
  }

  // ===== Export =====

  /**
   * GET /workforce/payroll-runs/:id/export
   * Export payroll run lines as CSV
   * RBAC: L4+ can export
   */
  @Get(':id/export')
  @Roles('L4', 'L5')
  async exportPayrollRun(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.payrollRunService.exportPayrollRunCsv(req.user.orgId, id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${id}.csv"`);
    res.send(csv);
  }

  // ===== Reports =====

  /**
   * GET /workforce/payroll-runs/reports/summary
   * Get payroll summary KPIs
   * RBAC: L4+ can view
   */
  @Get('reports/summary')
  @Roles('L4', 'L5')
  async getPayrollSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.payrollReportingService.getPayrollSummary(req.user.orgId, dateRange, branchId);
  }

  /**
   * GET /workforce/payroll-runs/reports/export/summary
   * Export payroll summary CSV
   * RBAC: L4+ can export
   */
  @Get('reports/export/summary')
  @Roles('L4', 'L5')
  async exportPayrollSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const csv = await this.payrollReportingService.exportPayrollSummaryCsv(req.user.orgId, dateRange);
    
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', 'attachment; filename="payroll-summary.csv"');
    res!.send(csv);
  }

  /**
   * GET /workforce/payroll-runs/reports/export/lines
   * Export payroll lines CSV
   * RBAC: L4+ can export
   */
  @Get('reports/export/lines')
  @Roles('L4', 'L5')
  async exportPayrollLines(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const csv = await this.payrollReportingService.exportPayrollLinesCsv(req.user.orgId, dateRange);
    
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', 'attachment; filename="payroll-lines.csv"');
    res!.send(csv);
  }

  /**
   * GET /workforce/payroll-runs/reports/audit
   * Export payroll audit trail CSV
   * RBAC: L5 only
   */
  @Get('reports/audit')
  @Roles('L5')
  async exportPayrollAudit(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const csv = await this.payrollReportingService.exportPayrollAuditCsv(req.user.orgId, dateRange);
    
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', 'attachment; filename="payroll-audit.csv"');
    res!.send(csv);
  }

  // ===== M10.7: Export Endpoints =====

  /**
   * POST /workforce/payroll-runs/:id/generate-payslips
   * Generate payslips for a calculated payroll run
   * RBAC: L4+ can generate
   */
  @Post(':id/generate-payslips')
  @Roles('L4', 'L5')
  async generatePayslips(@Param('id') id: string, @Request() req: any) {
    return this.payslipService.generatePayslipsForRun(req.user.orgId, id);
  }

  /**
   * GET /workforce/payroll-runs/:id/export/summary
   * Export payroll run summary CSV
   * RBAC: L4+ can export
   */
  @Get(':id/export/summary')
  @Roles('L4', 'L5')
  async exportRunSummary(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.payrollExportService.exportRunSummaryCsv(req.user.orgId, id);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${id}-summary.csv"`);
    res.send(csv);
  }

  /**
   * GET /workforce/payroll-runs/:id/export/payslips
   * Export payslip details CSV (per employee per component)
   * RBAC: L4+ can export
   */
  @Get(':id/export/payslips')
  @Roles('L4', 'L5')
  async exportPayslipDetails(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.payrollExportService.exportPayslipDetailsCsv(req.user.orgId, id);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${id}-payslips.csv"`);
    res.send(csv);
  }

  /**
   * GET /workforce/payroll-runs/:id/export/employer-cost
   * Export employer cost CSV (for accounting)
   * RBAC: L4+ can export
   */
  @Get(':id/export/employer-cost')
  @Roles('L4', 'L5')
  async exportEmployerCost(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.payrollExportService.exportEmployerCostCsv(req.user.orgId, id);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${id}-employer-cost.csv"`);
    res.send(csv);
  }
}
