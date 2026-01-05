/**
 * M11.3 Inventory Transfers Controller
 * 
 * REST API for inventory transfers:
 * - GET /inventory/transfers - List transfers (L2+)
 * - GET /inventory/transfers/:id - Get transfer detail (L2+)
 * - POST /inventory/transfers - Create draft transfer (L3+)
 * - POST /inventory/transfers/:id/ship - Ship transfer (L3+)
 * - POST /inventory/transfers/:id/receive - Receive transfer (L3+)
 * - POST /inventory/transfers/:id/void - Void draft transfer (L4+)
 * - GET /inventory/transfers/export - CSV export (L4+)
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
import { InventoryTransfersService, CreateTransferDto, ReceiveTransferDto, TransferQueryOptions } from './inventory-transfers.service';
import { InventoryTransferStatus } from '@chefcloud/db';

interface AuthenticatedRequest {
  user: {
    id: string;
    orgId: string;
    branchId?: string;
    roleLevel: number;
  };
}

@Controller('inventory/transfers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryTransfersController {
  constructor(
    private readonly transfersService: InventoryTransfersService,
  ) {}

  /**
   * List transfers
   */
  @Get()
  @Roles('L2', 'L3', 'L4', 'L5')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<any[]> {
    const options: TransferQueryOptions = {
      includeLines: false,
    };

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',') as InventoryTransferStatus[];
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (fromBranchId) options.fromBranchId = fromBranchId;
    if (toBranchId) options.toBranchId = toBranchId;
    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);

    return this.transfersService.findMany(req.user.orgId, options);
  }

  /**
   * Export transfers as CSV
   */
  @Get('export')
  @Roles('L4', 'L5')
  async export(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const options: TransferQueryOptions = {};

    if (status) {
      const statuses = status.split(',') as InventoryTransferStatus[];
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (fromBranchId) options.fromBranchId = fromBranchId;
    if (toBranchId) options.toBranchId = toBranchId;
    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);

    const { csv, hash } = await this.transfersService.exportCsv(req.user.orgId, options);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-transfers.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.status(HttpStatus.OK).send(csv);
  }

  /**
   * Get transfer by ID
   */
  @Get(':id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async findById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<any> {
    return this.transfersService.findById(req.user.orgId, id, { includeLines: true });
  }

  /**
   * Create a new draft transfer
   */
  @Post()
  @Roles('L3', 'L4', 'L5')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTransferDto,
  ): Promise<any> {
    return this.transfersService.create(req.user.orgId, req.user.id, dto);
  }

  /**
   * Ship a transfer (transitions DRAFT → IN_TRANSIT)
   */
  @Post(':id/ship')
  @Roles('L3', 'L4', 'L5')
  async ship(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<any> {
    return this.transfersService.ship(req.user.orgId, id, req.user.id);
  }

  /**
   * Receive a transfer (transitions IN_TRANSIT → RECEIVED)
   */
  @Post(':id/receive')
  @Roles('L3', 'L4', 'L5')
  async receive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto?: ReceiveTransferDto,
  ): Promise<any> {
    return this.transfersService.receive(req.user.orgId, id, req.user.id, dto);
  }

  /**
   * Void a draft transfer
   */
  @Post(':id/void')
  @Roles('L4', 'L5')
  async void(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<any> {
    return this.transfersService.void(req.user.orgId, id, req.user.id);
  }
}
