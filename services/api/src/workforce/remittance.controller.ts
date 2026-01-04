/**
 * M10.9: Remittance Controller
 *
 * REST endpoints for remittance batch management.
 * RBAC: L4+ for CRUD/approve/export, L5 only for post/pay/void.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RemittanceService, CreateBatchDto, AddLineDto, BatchListFilters } from './remittance.service';
import { Response } from 'express';

@Controller('orgs/:orgId/remittances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  /**
   * List remittance batches
   */
  @Get()
  @Roles('L4', 'L5')
  async listBatches(
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const filters: BatchListFilters = {};
    if (status) filters.status = status as any;
    if (type) filters.type = type as any;
    if (branchId) filters.branchId = branchId;

    return this.remittanceService.listBatches(orgId, filters);
  }

  /**
   * Create a new remittance batch
   */
  @Post()
  @Roles('L4', 'L5')
  async createBatch(
    @Param('orgId') orgId: string,
    @Body() dto: CreateBatchDto,
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.createBatch(orgId, req.user.sub, dto);
  }

  /**
   * Get batch details
   */
  @Get(':id')
  @Roles('L4', 'L5')
  async getBatch(@Param('orgId') orgId: string, @Param('id') id: string): Promise<any> {
    return this.remittanceService.getBatch(orgId, id);
  }

  /**
   * Update a DRAFT batch
   */
  @Patch(':id')
  @Roles('L4', 'L5')
  async updateBatch(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateBatchDto>,
  ): Promise<any> {
    return this.remittanceService.updateBatch(orgId, id, dto);
  }

  /**
   * Delete a DRAFT batch
   */
  @Delete(':id')
  @Roles('L4', 'L5')
  async deleteBatch(@Param('orgId') orgId: string, @Param('id') id: string): Promise<any> {
    return this.remittanceService.deleteBatch(orgId, id);
  }

  /**
   * Add a line to a batch
   */
  @Post(':id/lines')
  @Roles('L4', 'L5')
  async addLine(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AddLineDto,
  ): Promise<any> {
    return this.remittanceService.addLine(orgId, id, dto);
  }

  /**
   * Remove a line from a batch
   */
  @Delete(':id/lines/:lineId')
  @Roles('L4', 'L5')
  async removeLine(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ): Promise<any> {
    return this.remittanceService.removeLine(orgId, id, lineId);
  }

  /**
   * Get payment preview
   */
  @Get(':id/preview')
  @Roles('L4', 'L5')
  async getPreview(@Param('orgId') orgId: string, @Param('id') id: string): Promise<any> {
    return this.remittanceService.getPaymentPreview(orgId, id);
  }

  /**
   * Approve batch (DRAFT → APPROVED)
   */
  @Post(':id/approve')
  @Roles('L4', 'L5')
  async approveBatch(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.transitionStatus(orgId, id, req.user.sub, 'APPROVED');
  }

  /**
   * Post batch (APPROVED → POSTED) - L5 only
   */
  @Post(':id/post')
  @Roles('L5')
  async postBatch(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.transitionStatus(orgId, id, req.user.sub, 'POSTED');
  }

  /**
   * Pay batch (POSTED → PAID) - L5 only
   */
  @Post(':id/pay')
  @Roles('L5')
  async payBatch(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.transitionStatus(orgId, id, req.user.sub, 'PAID');
  }

  /**
   * Void batch - L5 only
   */
  @Post(':id/void')
  @Roles('L5')
  async voidBatch(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.transitionStatus(orgId, id, req.user.sub, 'VOID');
  }

  /**
   * Generate batch from payroll runs
   */
  @Post('generate-from-payroll')
  @Roles('L4', 'L5')
  async generateFromPayroll(
    @Param('orgId') orgId: string,
    @Body() body: { branchId?: string; payrollRunIds?: string[]; idempotencyKey?: string },
    @Request() req: any,
  ): Promise<any> {
    return this.remittanceService.generateFromPayrollRuns(orgId, req.user.sub, body);
  }
}

/**
 * Reporting endpoints for remittances
 */
@Controller('orgs/:orgId/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RemittanceReportsController {
  constructor(private readonly remittanceService: RemittanceService) {}

  /**
   * Get remittance KPIs
   */
  @Get('remittances/kpis')
  @Roles('L4', 'L5')
  async getKpis(
    @Param('orgId') orgId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.remittanceService.getKpis(orgId, branchId);
  }

  /**
   * Export batches as CSV
   */
  @Get('export/remittances')
  @Roles('L4', 'L5')
  async exportBatches(
    @Param('orgId') orgId: string,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('branchId') branchId?: string,
  ) {
    const filters: BatchListFilters = {};
    if (status) filters.status = status as any;
    if (type) filters.type = type as any;
    if (branchId) filters.branchId = branchId;

    const csv = await this.remittanceService.exportBatchesCsv(orgId, filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=remittances.csv');
    return res.send(csv);
  }

  /**
   * Export lines as CSV
   */
  @Get('export/remittance-lines')
  @Roles('L4', 'L5')
  async exportLines(
    @Param('orgId') orgId: string,
    @Res() res: Response,
    @Query('batchId') batchId?: string,
  ) {
    const csv = await this.remittanceService.exportLinesCsv(orgId, batchId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=remittance-lines.csv');
    return res.send(csv);
  }
}
