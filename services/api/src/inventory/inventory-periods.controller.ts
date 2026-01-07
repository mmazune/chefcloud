/**
 * M12.1 + M12.2 Inventory Periods Controller
 *
 * REST endpoints for inventory period management:
 * - List/create/close/reopen periods
 * - View valuation/movements/reconciliation
 * - Export CSV + close pack
 * - Override lock (L5 only)
 * - Pre-close check + period generation
 * - Period event log
 */
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryPeriodsService, ClosePeriodDto, CreatePeriodDto, ReopenPeriodDto } from './inventory-periods.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { InventoryPeriodExportService } from './inventory-period-export.service';
import { InventoryPreCloseCheckService } from './inventory-preclose-check.service';
import { InventoryPeriodGenerationService } from './inventory-period-generation.service';
import { InventoryPeriodEventsService } from './inventory-period-events.service';
import { InventoryClosePackService } from './inventory-close-pack.service';

// DTO classes for Swagger
class CreatePeriodBody {
  branchId: string;
  startDate: string;
  endDate: string;
  lockReason?: string;
}

class ClosePeriodBody {
  branchId: string;
  startDate: string;
  endDate: string;
  lockReason?: string;
}

class OverridePostBody {
  reason: string;
  actionType: string;
  entityType: string;
  entityId: string;
}

// M12.2 DTOs
class ReopenPeriodBody {
  reason: string;
}

class GeneratePeriodsBody {
  branchId: string;
  fromMonth: string; // YYYY-MM
  toMonth: string;   // YYYY-MM
}

class PreCloseCheckQuery {
  branchId: string;
  startDate: string;
  endDate: string;
}

@ApiTags('Inventory Periods')
@ApiBearerAuth()
@Controller('inventory/periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryPeriodsController {
  constructor(
    private readonly periodsService: InventoryPeriodsService,
    private readonly reconciliationService: InventoryReconciliationService,
    private readonly exportService: InventoryPeriodExportService,
    private readonly preCloseCheckService: InventoryPreCloseCheckService,
    private readonly periodGenerationService: InventoryPeriodGenerationService,
    private readonly periodEventsService: InventoryPeriodEventsService,
    private readonly closePackService: InventoryClosePackService,
  ) {}

  /**
   * List periods for the org.
   */
  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'List inventory periods' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'CLOSED'] })
  @ApiResponse({ status: 200, description: 'List of periods' })
  async listPeriods(
    @Request() req,
    @Query('branchId') branchId?: string,
    @Query('status') status?: 'OPEN' | 'CLOSED',
  ) {
    return this.periodsService.listPeriods(req.user.orgId, branchId, { status });
  }

  /**
   * Get single period by ID.
   */
  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Get period details' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'Period details' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  async getPeriod(@Request() req, @Param('id') id: string) {
    return this.periodsService.getPeriod(req.user.orgId, id);
  }

  /**
   * Create a new period (OPEN).
   */
  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create inventory period' })
  @ApiBody({ type: CreatePeriodBody })
  @ApiResponse({ status: 201, description: 'Period created' })
  @ApiResponse({ status: 400, description: 'Invalid dates' })
  @ApiResponse({ status: 409, description: 'Period overlaps' })
  async createPeriod(@Request() req, @Body() body: CreatePeriodBody) {
    const dto: CreatePeriodDto = {
      branchId: body.branchId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      lockReason: body.lockReason,
    };
    return this.periodsService.createPeriod(req.user.orgId, req.user.sub, dto);
  }

  /**
   * Close a period (generate snapshots + lock).
   */
  @Post('close')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close inventory period' })
  @ApiBody({ type: ClosePeriodBody })
  @ApiResponse({ status: 200, description: 'Period closed' })
  @ApiResponse({ status: 400, description: 'Blocking states exist' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async closePeriod(@Request() req, @Body() body: ClosePeriodBody) {
    const dto: ClosePeriodDto = {
      branchId: body.branchId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      lockReason: body.lockReason,
    };
    return this.periodsService.closePeriod(req.user.orgId, req.user.sub, dto);
  }

  /**
   * Check blocking states before close.
   */
  @Get('check-blockers')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Check blocking states before close' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async checkBlockers(
    @Request() req,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.periodsService.checkBlockingStates(
      req.user.orgId,
      branchId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * Get valuation snapshots for a period.
   */
  @Get(':id/valuation')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Get valuation snapshots' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'Valuation data' })
  async getValuation(@Request() req, @Param('id') id: string) {
    return this.periodsService.getValuationSnapshots(req.user.orgId, id);
  }

  /**
   * Get movement summaries for a period.
   */
  @Get(':id/movements')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Get movement summaries' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'Movement data' })
  async getMovements(@Request() req, @Param('id') id: string): Promise<unknown> {
    return this.periodsService.getMovementSummaries(req.user.orgId, id);
  }

  /**
   * Get GL reconciliation report.
   */
  @Get(':id/reconciliation')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Get GL reconciliation report' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation data' })
  async getReconciliation(@Request() req, @Param('id') id: string) {
    return this.reconciliationService.getReconciliation(req.user.orgId, id);
  }

  /**
   * Export valuation CSV.
   */
  @Get(':id/export/valuation.csv')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Export valuation CSV' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportValuation(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportValuation(
      req.user.orgId,
      req.user.sub,
      id,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.content);
  }

  /**
   * Export movements CSV.
   */
  @Get(':id/export/movements.csv')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Export movements CSV' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportMovements(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportMovements(
      req.user.orgId,
      req.user.sub,
      id,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.content);
  }

  /**
   * Export reconciliation CSV.
   */
  @Get(':id/export/reconciliation.csv')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT')
  @ApiOperation({ summary: 'Export reconciliation CSV' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportReconciliation(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportReconciliation(
      req.user.orgId,
      req.user.sub,
      id,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.content);
  }

  /**
   * Override post - allows L5 to post into closed period (one-time).
   */
  @Post(':id/override-post')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Override period lock (L5 only)' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiBody({ type: OverridePostBody })
  @ApiResponse({ status: 200, description: 'Override logged' })
  async overridePost(
    @Request() req,
    @Param('id') id: string,
    @Body() body: OverridePostBody,
  ) {
    // Verify period exists
    await this.periodsService.getPeriod(req.user.orgId, id);

    // Log the override usage
    await this.periodsService.logOverrideUsage(
      req.user.orgId,
      req.user.sub,
      id,
      body.reason,
      body.actionType,
      body.entityType,
      body.entityId,
    );

    return {
      success: true,
      message: 'Override logged. Proceed with blocked action.',
      periodId: id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // M12.2: Pre-Close Check, Generation, Reopen, Close Pack, Events
  // ═══════════════════════════════════════════════════════════════════

  /**
   * M12.2: Run pre-close check.
   * Returns READY/BLOCKED/WARNING status with details.
   */
  @Get('preclose-check')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'M12.2: Run pre-close validation check' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Pre-close check result' })
  async preCloseCheck(
    @Request() req,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.preCloseCheckService.runCheck(
      req.user.orgId,
      branchId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * M12.2: Generate monthly periods.
   */
  @Post('generate')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M12.2: Auto-generate monthly periods' })
  @ApiBody({ type: GeneratePeriodsBody })
  @ApiResponse({ status: 200, description: 'Periods generated' })
  async generatePeriods(@Request() req, @Body() body: GeneratePeriodsBody) {
    return this.periodGenerationService.generatePeriods(
      req.user.orgId,
      req.user.sub,
      {
        branchId: body.branchId,
        fromMonth: body.fromMonth,
        toMonth: body.toMonth,
      },
    );
  }

  /**
   * M12.2: Reopen a closed period (L5 only).
   */
  @Post(':id/reopen')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M12.2: Reopen closed period (L5 only)' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiBody({ type: ReopenPeriodBody })
  @ApiResponse({ status: 200, description: 'Period reopened' })
  @ApiResponse({ status: 400, description: 'Period not closed or reason too short' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  async reopenPeriod(
    @Request() req,
    @Param('id') id: string,
    @Body() body: ReopenPeriodBody,
  ) {
    const dto: ReopenPeriodDto = {
      periodId: id,
      reason: body.reason,
    };
    return this.periodsService.reopenPeriod(req.user.orgId, req.user.sub, dto);
  }

  /**
   * M12.2: Get close pack summary.
   */
  @Get(':id/close-pack')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER')
  @ApiOperation({ summary: 'M12.2: Get close pack summary with export URLs' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'Close pack summary' })
  async getClosePack(@Request() req, @Param('id') id: string) {
    return this.closePackService.getClosePack(req.user.orgId, req.user.sub, id);
  }

  /**
   * M12.2: Export close pack index CSV.
   */
  @Get(':id/export/close-pack-index.csv')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER')
  @ApiOperation({ summary: 'M12.2: Export close pack index CSV' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportClosePackIndex(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.closePackService.exportIndex(
      req.user.orgId,
      req.user.sub,
      id,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.setHeader('X-Nimbus-Bundle-Hash', result.bundleHash);
    res.send(result.content);
  }

  /**
   * M12.2: Get period events (audit log).
   */
  @Get(':id/events')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'M12.2: Get period event log' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'List of events' })
  async getPeriodEvents(@Request() req, @Param('id') id: string) {
    return this.periodEventsService.getEventsForPeriod(req.user.orgId, id);
  }

  /**
   * M12.2: Get revision history for a period.
   */
  @Get(':id/revisions')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK_MANAGER')
  @ApiOperation({ summary: 'M12.2: Get snapshot revision history' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @ApiResponse({ status: 200, description: 'List of revision numbers' })
  async getRevisionHistory(@Request() req, @Param('id') id: string) {
    const revisions = await this.periodsService.getRevisionHistory(
      req.user.orgId,
      id,
    );
    return { periodId: id, revisions };
  }
}
