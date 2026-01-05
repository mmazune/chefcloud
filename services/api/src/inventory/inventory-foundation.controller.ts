/**
 * M11.1 Inventory Foundation Controller
 * 
 * Provides API endpoints for:
 * - Units of Measure (UOM) management
 * - Inventory Locations management
 * - Stock Ledger queries
 * - Stock Adjustments (with approval workflow)
 * - Cycle Count Sessions
 * - Inventory Exports
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { Prisma } from '@chefcloud/db';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryUomService } from './inventory-uom.service';
import { InventoryLocationsService, CreateLocationDto as ServiceCreateLocationDto } from './inventory-locations.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryAdjustmentsService, AdjustmentReason } from './inventory-adjustments.service';
import { InventoryCountsService } from './inventory-counts.service';
import { InventoryExportService, ExportFormat } from './inventory-export.service';

// ============= DTOs =============

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// --- UOM DTOs ---
export class CreateUomDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsString()
  @IsOptional()
  baseUnitId?: string;
}

export class UpdateUomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  symbol?: string;
}

export class CreateConversionDto {
  @IsString()
  fromUomId!: string;

  @IsString()
  toUomId!: string;

  @IsNumber()
  @Min(0)
  factor!: number;
}

// --- Location DTOs ---
export class CreateLocationDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Prisma.InputJsonValue;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Prisma.InputJsonValue;
}

// --- Adjustment DTOs ---
export class CreateAdjustmentDto {
  @IsString()
  itemId!: string;

  @IsString()
  locationId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  qty!: number;

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  autoApprove?: boolean;
}

// --- Count Session DTOs ---
export class CreateCountSessionDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  locationId?: string;
}

export class CountLineDto {
  @IsString()
  itemId!: string;

  @IsString()
  locationId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  countedQty!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class FinalizeSessionDto {
  @IsBoolean()
  @IsOptional()
  allowNegative?: boolean;
}

// ============= Controller =============

@Controller('inventory/foundation')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class InventoryFoundationController {
  constructor(
    private readonly uomService: InventoryUomService,
    private readonly locationsService: InventoryLocationsService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly adjustmentsService: InventoryAdjustmentsService,
    private readonly countsService: InventoryCountsService,
    private readonly exportService: InventoryExportService,
  ) {}

  // ============= UOM Endpoints =============

  @Post('uom')
  @Roles('L4')
  async createUom(@Req() req: any, @Body() dto: CreateUomDto): Promise<any> {
    return this.uomService.createUom(req.user.orgId, dto);
  }

  @Get('uom')
  @Roles('L2')
  async listUoms(@Req() req: any): Promise<any> {
    return this.uomService.listUoms(req.user.orgId);
  }

  @Get('uom/:id')
  @Roles('L2')
  async getUom(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.uomService.getUom(req.user.orgId, id);
  }

  @Patch('uom/:id')
  @Roles('L4')
  async updateUom(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUomDto,
  ): Promise<any> {
    return this.uomService.updateUom(req.user.orgId, id, dto);
  }

  @Post('uom/conversions')
  @Roles('L4')
  async createConversion(@Req() req: any, @Body() dto: CreateConversionDto): Promise<any> {
    return this.uomService.createConversion(req.user.orgId, dto);
  }

  @Get('uom/conversions/list')
  @Roles('L2')
  async listConversions(@Req() req: any): Promise<any> {
    return this.uomService.listConversions(req.user.orgId);
  }

  @Post('uom/convert')
  @Roles('L2')
  async convert(
    @Req() req: any,
    @Body() dto: { fromUomId: string; toUomId: string; qty: number },
  ): Promise<any> {
    const result = await this.uomService.convert(
      req.user.orgId,
      dto.fromUomId,
      dto.toUomId,
      dto.qty,
    );
    return { result: result.toString() };
  }

  // ============= Location Endpoints =============

  @Post('locations')
  @Roles('L4')
  async createLocation(@Req() req: any, @Body() dto: CreateLocationDto): Promise<any> {
    return this.locationsService.createLocation(req.user.orgId, req.user.branchId, dto);
  }

  @Get('locations')
  @Roles('L2')
  async listLocations(@Req() req: any): Promise<any> {
    return this.locationsService.listLocations(req.user.orgId, req.user.branchId);
  }

  @Get('locations/:id')
  @Roles('L2')
  async getLocation(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.locationsService.getLocation(req.user.orgId, id);
  }

  @Patch('locations/:id')
  @Roles('L4')
  async updateLocation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<any> {
    return this.locationsService.updateLocation(req.user.orgId, id, {
      name: dto.name,
      isActive: dto.active,
      metadata: dto.metadata,
    });
  }

  // ============= Ledger Endpoints =============

  @Get('ledger/on-hand/:itemId')
  @Roles('L2')
  async getOnHand(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Query('locationId') locationId?: string,
  ): Promise<any> {
    // If no locationId, get default location for branch
    const locId = locationId ?? (await this.locationsService.getOrCreateDefaultLocation(req.user.orgId, req.user.branchId)).id;
    const onHand = await this.ledgerService.getOnHand(itemId, locId, req.user.branchId);
    return { itemId, locationId: locId, onHand: onHand.toString() };
  }

  @Get('ledger/on-hand-by-location')
  @Roles('L2')
  async getOnHandByLocation(
    @Req() req: any,
    @Query('itemId') itemId: string,
  ): Promise<any> {
    const results = await this.ledgerService.getOnHandByLocation(itemId, req.user.branchId);
    return results.map((r) => ({
      locationId: r.locationId,
      locationCode: r.locationCode,
      locationName: r.locationName,
      onHand: r.onHand.toString(),
    }));
  }

  @Get('ledger/on-hand-by-branch')
  @Roles('L2')
  async getOnHandByBranch(
    @Req() req: any,
    @Query('locationId') locationId?: string,
  ): Promise<any> {
    const results = await this.ledgerService.getOnHandByBranch(req.user.branchId, locationId);
    return results.map((r) => ({
      itemId: r.itemId,
      itemSku: r.itemSku,
      itemName: r.itemName,
      locationCode: r.locationCode,
      locationName: r.locationName,
      onHand: r.onHand.toString(),
    }));
  }

  @Get('ledger/entries')
  @Roles('L2')
  async getLedgerEntries(
    @Req() req: any,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('reason') reason?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<any> {
    return this.ledgerService.getLedgerEntries(req.user.orgId, req.user.branchId, {
      itemId,
      locationId,
      reason,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ============= Adjustment Endpoints =============

  @Post('adjustments')
  @Roles('L3')
  async createAdjustment(@Req() req: any, @Body() dto: CreateAdjustmentDto): Promise<any> {
    return this.adjustmentsService.createAdjustment(
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
      dto,
      { autoApprove: dto.autoApprove },
    );
  }

  @Get('adjustments')
  @Roles('L2')
  async listAdjustments(
    @Req() req: any,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('reason') reason?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<any> {
    return this.adjustmentsService.listAdjustments(req.user.orgId, req.user.branchId, {
      itemId,
      locationId,
      status,
      reason,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('adjustments/:id')
  @Roles('L2')
  async getAdjustment(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.adjustmentsService.getAdjustment(req.user.orgId, req.user.branchId, id);
  }

  @Post('adjustments/:id/approve')
  @Roles('L4')
  @HttpCode(HttpStatus.OK)
  async approveAdjustment(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.adjustmentsService.approveAdjustment(
      req.user.orgId,
      req.user.branchId,
      id,
      req.user.userId,
    );
  }

  @Post('adjustments/:id/reject')
  @Roles('L4')
  @HttpCode(HttpStatus.OK)
  async rejectAdjustment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ): Promise<any> {
    return this.adjustmentsService.rejectAdjustment(
      req.user.orgId,
      req.user.branchId,
      id,
      req.user.userId,
      dto.reason,
    );
  }

  // ============= Count Session Endpoints =============

  @Post('counts/sessions')
  @Roles('L3')
  async createCountSession(@Req() req: any, @Body() dto: CreateCountSessionDto): Promise<any> {
    return this.countsService.createSession(
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
      dto,
    );
  }

  @Get('counts/sessions')
  @Roles('L2')
  async listCountSessions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<any> {
    return this.countsService.listSessions(req.user.orgId, req.user.branchId, {
      status,
      locationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('counts/sessions/:id')
  @Roles('L2')
  async getCountSession(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.countsService.getSession(req.user.orgId, req.user.branchId, id);
  }

  @Post('counts/sessions/:id/lines')
  @Roles('L3')
  async upsertCountLine(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Body() dto: CountLineDto,
  ): Promise<any> {
    return this.countsService.upsertCountLine(
      req.user.orgId,
      req.user.branchId,
      sessionId,
      req.user.userId,
      dto,
    );
  }

  @Get('counts/sessions/:id/lines')
  @Roles('L2')
  async getCountSessionLines(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Query('hasVariance') hasVariance?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<any> {
    return this.countsService.getSessionLines(req.user.orgId, req.user.branchId, sessionId, {
      hasVariance: hasVariance === 'true' ? true : hasVariance === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('counts/sessions/:id/finalize')
  @Roles('L4')
  @HttpCode(HttpStatus.OK)
  async finalizeCountSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: FinalizeSessionDto,
  ): Promise<any> {
    return this.countsService.finalizeSession(
      req.user.orgId,
      req.user.branchId,
      id,
      req.user.userId,
      { allowNegative: dto.allowNegative },
    );
  }

  @Post('counts/sessions/:id/cancel')
  @Roles('L4')
  @HttpCode(HttpStatus.OK)
  async cancelCountSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ): Promise<any> {
    return this.countsService.cancelSession(
      req.user.orgId,
      req.user.branchId,
      id,
      req.user.userId,
      dto.reason,
    );
  }

  // ============= Export Endpoints =============

  @Get('exports/inventory-levels')
  @Roles('L2')
  async exportInventoryLevels(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('locationId') locationId?: string,
    @Query('includeZeroStock') includeZeroStock?: string,
  ): Promise<void> {
    const result = await this.exportService.exportInventoryLevels(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        locationId,
        includeZeroStock: includeZeroStock === 'true',
      },
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }

  @Get('exports/ledger')
  @Roles('L2')
  async exportLedger(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const result = await this.exportService.exportLedgerEntries(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        itemId,
        locationId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }

  @Get('exports/adjustments')
  @Roles('L2')
  async exportAdjustments(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const result = await this.exportService.exportAdjustments(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        locationId,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }

  @Get('exports/count-sessions')
  @Roles('L2')
  async exportCountSessions(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('sessionId') sessionId?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const result = await this.exportService.exportCountSessions(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        sessionId,
        locationId,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }

  // M11.4: Recipes export
  @Get('exports/recipes')
  @Roles('L2')
  async exportRecipes(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<void> {
    const result = await this.exportService.exportRecipes(req.user.orgId, {
      format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
      includeInactive: includeInactive === 'true',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }

  // M11.4: Depletions export
  @Get('exports/depletions')
  @Roles('L3')
  async exportDepletions(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const result = await this.exportService.exportDepletions(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.setHeader('X-Record-Count', result.recordCount.toString());
    res.send(result.data);
  }
}
