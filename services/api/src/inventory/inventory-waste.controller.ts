/**
 * M11.3 Inventory Waste Controller
 * 
 * REST API for inventory waste:
 * - GET /inventory/waste - List waste documents (L2+)
 * - GET /inventory/waste/:id - Get waste detail (L2+)
 * - POST /inventory/waste - Create draft waste (L3+)
 * - POST /inventory/waste/:id/post - Post waste (L3+)
 * - POST /inventory/waste/:id/void - Void draft waste (L4+)
 * - GET /inventory/waste/export - CSV export (L4+)
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryWasteService, CreateWasteDto, WasteQueryOptions } from './inventory-waste.service';
import { InventoryWasteStatus, InventoryWasteReason } from '@chefcloud/db';

interface AuthenticatedRequest {
  user: {
    id: string;
    orgId: string;
    branchId: string;
    roleLevel: number;
  };
}

@Controller('inventory/waste')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryWasteController {
  constructor(
    private readonly wasteService: InventoryWasteService,
  ) {}

  /**
   * List waste documents
   */
  @Get()
  @Roles('L2', 'L3', 'L4', 'L5')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('reason') reason?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<any[]> {
    const options: WasteQueryOptions = {
      includeLines: false,
    };

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',') as InventoryWasteStatus[];
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (reason) {
      options.reason = reason as InventoryWasteReason;
    }

    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);

    // Use query param branchId if provided, otherwise use user's branch
    const effectiveBranchId = branchId || req.user.branchId;
    
    return this.wasteService.findMany(req.user.orgId, effectiveBranchId, options);
  }

  /**
   * Export waste as CSV
   */
  @Get('export')
  @Roles('L4', 'L5')
  async export(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('reason') reason?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const options: WasteQueryOptions = {};

    if (status) {
      const statuses = status.split(',') as InventoryWasteStatus[];
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (reason) {
      options.reason = reason as InventoryWasteReason;
    }

    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);

    const effectiveBranchId = branchId || req.user.branchId;
    const { csv, hash } = await this.wasteService.exportCsv(req.user.orgId, effectiveBranchId, options);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-waste.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.status(HttpStatus.OK).send(csv);
  }

  /**
   * Get waste by ID
   */
  @Get(':id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async findById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const effectiveBranchId = branchId || req.user.branchId;
    return this.wasteService.findById(req.user.orgId, effectiveBranchId, id, { includeLines: true });
  }

  /**
   * Create a new draft waste document
   */
  @Post()
  @Roles('L3', 'L4', 'L5')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWasteDto,
  ): Promise<any> {
    // Use branchId from body if provided, otherwise use user's branch
    const effectiveDto = {
      ...dto,
      branchId: dto.branchId || req.user.branchId,
    };
    return this.wasteService.create(req.user.orgId, req.user.id, effectiveDto);
  }

  /**
   * Post a waste document (transitions DRAFT → POSTED)
   */
  @Post(':id/post')
  @Roles('L3', 'L4', 'L5')
  async post(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const effectiveBranchId = branchId || req.user.branchId;
    return this.wasteService.post(req.user.orgId, effectiveBranchId, id, req.user.id);
  }

  /**
   * Void a draft waste document
   */
  @Post(':id/void')
  @Roles('L4', 'L5')
  async void(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const effectiveBranchId = branchId || req.user.branchId;
    return this.wasteService.void(req.user.orgId, effectiveBranchId, id, req.user.id);
  }
}
