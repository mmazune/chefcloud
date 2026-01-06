/**
 * M11.7 Inventory Lots Controller
 * 
 * Endpoints:
 * - GET /inventory/lots - List lots with filters
 * - GET /inventory/lots/:id - Get lot details
 * - GET /inventory/lots/:id/traceability - Get traceability info
 * - GET /inventory/lots/expiring-soon - Get lots expiring within threshold
 * - POST /inventory/lots/allocate - FEFO allocation
 * - POST /inventory/lots/:id/quarantine - Put lot in quarantine
 * - POST /inventory/lots/:id/release - Release from quarantine
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryLotsService, LotSummary } from './inventory-lots.service';
import { LotStatus } from '@chefcloud/db';

interface ListLotsQuery {
  branchId?: string;
  itemId?: string;
  locationId?: string;
  status?: string;
  includeExpired?: string;
  includeDepleted?: string;
  limit?: string;
  offset?: string;
}

interface ExpiringSoonQuery {
  branchId?: string;
  days?: string;
  limit?: string;
}

interface AllocateDto {
  branchId: string;
  itemId: string;
  locationId: string;
  requestedQty: number;
  sourceType: string;
  sourceId: string;
}

@Controller('inventory/lots')
@UseGuards(JwtAuthGuard)
export class InventoryLotsController {
  constructor(private readonly lotsService: InventoryLotsService) {}

  /**
   * GET /inventory/lots
   * List lots with optional filters
   */
  @Get()
  @Roles('L2', 'L3', 'L4', 'L5') // L2+
  async listLots(
    @Req() req: Request,
    @Query() query: ListLotsQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const statusInput = query.status;
    let status: LotStatus | LotStatus[] | undefined;
    if (statusInput) {
      if (statusInput.includes(',')) {
        status = statusInput.split(',').map((s) => s.trim() as LotStatus);
      } else {
        status = statusInput as LotStatus;
      }
    }

    const { lots, total } = await this.lotsService.listLots({
      orgId,
      branchId: query.branchId,
      itemId: query.itemId,
      locationId: query.locationId,
      status,
      includeExpired: query.includeExpired === 'true',
      includeDepleted: query.includeDepleted === 'true',
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      items: lots,
      total,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
  }

  /**
   * GET /inventory/lots/expiring-soon
   * Get lots expiring within threshold days
   */
  @Get('expiring-soon')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+
  async getExpiringSoon(
    @Req() req: Request,
    @Query() query: ExpiringSoonQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const daysThreshold = query.days ? parseInt(query.days, 10) : 30;
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const lots = await this.lotsService.getExpiringSoon({
      orgId,
      branchId: query.branchId,
      daysThreshold,
      limit,
    });

    return {
      items: lots,
      daysThreshold,
      total: lots.length,
    };
  }

  /**
   * POST /inventory/lots/allocate
   * Allocate stock using FEFO (First Expiry First Out)
   * 
   * This endpoint allocates from lots and decrements them.
   * Returns the allocation details for traceability.
   */
  @Post('allocate')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+
  @HttpCode(HttpStatus.CREATED)
  async allocate(
    @Req() req: Request,
    @Body() body: AllocateDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    const _userId = (req as any).user?.sub;

    if (!orgId) throw new NotFoundException('Organization not found');

    const { branchId, itemId, locationId, requestedQty, sourceType, sourceId } = body;

    // First, calculate FEFO allocation
    const { allocations, totalAllocated, shortfall } = await this.lotsService.allocateFEFO({
      orgId,
      branchId,
      itemId,
      locationId,
      qtyNeeded: requestedQty,
      excludeExpired: true,
    });

    // Check if we can fulfill the request
    if (shortfall.gt(0)) {
      throw new BadRequestException(
        `Insufficient stock. Requested ${requestedQty}, available ${totalAllocated.toNumber()}. Shortfall: ${shortfall.toNumber()}`,
      );
    }

    // Decrement each lot and create allocations
    for (const alloc of allocations) {
      await this.lotsService.decrementLot({
        lotId: alloc.lotId,
        qty: alloc.allocatedQty,
        sourceType,
        sourceId,
        allocationOrder: alloc.allocationOrder,
      });
    }

    return {
      success: true,
      allocations: allocations.map((a) => ({
        lotId: a.lotId,
        lotNumber: a.lotNumber,
        allocatedQty: a.allocatedQty.toNumber(),
        expiryDate: a.expiryDate,
      })),
      totalAllocated: totalAllocated.toNumber(),
      shortfall: 0,
    };
  }

  /**
   * GET /inventory/lots/:id
   * Get lot details
   */
  @Get(':id')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+
  async getLot(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<LotSummary> {
    const lot = await this.lotsService.getLot(id);
    if (!lot) {
      throw new NotFoundException(`Lot ${id} not found`);
    }
    return lot;
  }

  /**
   * GET /inventory/lots/:id/traceability
   * Get traceability info for a lot
   */
  @Get(':id/traceability')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+
  async getTraceability(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<object> {
    const result = await this.lotsService.getTraceability(id);
    if (!result.lot) {
      throw new NotFoundException(`Lot ${id} not found`);
    }
    return result;
  }

  /**
   * POST /inventory/lots/:id/quarantine
   * Put lot in quarantine
   */
  @Post(':id/quarantine')
  @Roles('L3', 'L4', 'L5') // L3+
  @HttpCode(HttpStatus.OK)
  async quarantineLot(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<object> {
    const userId = (req as any).user?.sub;
    await this.lotsService.quarantineLot(id, userId);
    return { success: true, lotId: id, status: 'QUARANTINE' };
  }

  /**
   * POST /inventory/lots/:id/release
   * Release lot from quarantine
   */
  @Post(':id/release')
  @Roles('L3', 'L4', 'L5') // L3+
  @HttpCode(HttpStatus.OK)
  async releaseLot(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<object> {
    const userId = (req as any).user?.sub;
    await this.lotsService.releaseLot(id, userId);
    const lot = await this.lotsService.getLot(id);
    return { success: true, lotId: id, status: lot?.status };
  }
}
