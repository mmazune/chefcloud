/**
 * M11.2 Procurement Controller
 * 
 * API endpoints for:
 * - Purchase Orders (CRUD + workflow)
 * - Goods Receipts (create, post, void)
 * - Procurement KPIs and exports
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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PurchaseOrdersService, CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './purchase-orders.service';
import { ReceiptsService, CreateReceiptDto } from './receipts.service';
import { ProcurementReportingService, ExportFormat } from './procurement-reporting.service';

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============= DTOs =============

class CreatePOLineDto {
  @IsString()
  itemId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  qtyOrderedInput!: number;

  @IsString()
  inputUomId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsBoolean()
  @IsOptional()
  allowOverReceipt?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

class CreatePurchaseOrderRequestDto {
  @IsString()
  vendorId!: string;

  @IsDateString()
  @IsOptional()
  expectedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePOLineDto)
  lines!: CreatePOLineDto[];
}

class UpdatePurchaseOrderRequestDto {
  @IsDateString()
  @IsOptional()
  expectedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePOLineDto)
  @IsOptional()
  lines?: CreatePOLineDto[];
}

class CreateReceiptLineDto {
  @IsString()
  itemId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  @IsOptional()
  poLineId?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  qtyReceivedInput!: number;

  @IsString()
  inputUomId!: string;

  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

class CreateReceiptRequestDto {
  @IsString()
  purchaseOrderId!: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptLineDto)
  lines!: CreateReceiptLineDto[];
}

class CancelPODto {
  @IsString()
  @IsOptional()
  reason?: string;
}

class VoidReceiptDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

// ============= Controller =============

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class ProcurementController {
  constructor(
    private readonly poService: PurchaseOrdersService,
    private readonly receiptsService: ReceiptsService,
    private readonly reportingService: ProcurementReportingService,
  ) {}

  // ============= Purchase Orders =============

  @Post('purchase-orders')
  @Roles('L3', 'L4', 'L5')
  async createPurchaseOrder(@Req() req: any, @Body() dto: CreatePurchaseOrderRequestDto): Promise<any> {
    return this.poService.create(
      req.user.orgId,
      req.user.branchId,
      req.user.id,
      {
        vendorId: dto.vendorId,
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
        lines: dto.lines,
      },
    );
  }

  @Get('purchase-orders')
  @Roles('L2', 'L3', 'L4', 'L5')
  async listPurchaseOrders(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('includeLines') includeLines?: string,
  ): Promise<any[]> {
    return this.poService.findMany(req.user.orgId, req.user.branchId, {
      status: status ? (status.split(',') as any[]) : undefined,
      vendorId,
      includeLines: includeLines === 'true',
      includeVendor: true,
    });
  }

  @Get('purchase-orders/:id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getPurchaseOrder(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.poService.findById(req.user.orgId, req.user.branchId, id);
  }

  @Patch('purchase-orders/:id')
  @Roles('L3', 'L4', 'L5')
  async updatePurchaseOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderRequestDto,
  ): Promise<any> {
    return this.poService.update(
      req.user.orgId,
      req.user.branchId,
      id,
      req.user.id,
      {
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        notes: dto.notes,
        lines: dto.lines,
      },
    );
  }

  @Post('purchase-orders/:id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles('L3', 'L4', 'L5')
  async submitPurchaseOrder(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.poService.submit(req.user.orgId, req.user.branchId, id, req.user.id);
  }

  @Post('purchase-orders/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles('L4', 'L5')
  async approvePurchaseOrder(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.poService.approve(req.user.orgId, req.user.branchId, id, req.user.id);
  }

  @Post('purchase-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('L4', 'L5')
  async cancelPurchaseOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelPODto,
  ): Promise<any> {
    return this.poService.cancel(req.user.orgId, req.user.branchId, id, req.user.id, dto.reason);
  }

  // ============= Receipts =============

  @Post('receipts')
  @Roles('L3', 'L4', 'L5')
  async createReceipt(@Req() req: any, @Body() dto: CreateReceiptRequestDto): Promise<any> {
    return this.receiptsService.create(
      req.user.orgId,
      req.user.branchId,
      req.user.id,
      dto,
    );
  }

  @Get('receipts')
  @Roles('L2', 'L3', 'L4', 'L5')
  async listReceipts(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('includeLines') includeLines?: string,
  ): Promise<any[]> {
    return this.receiptsService.findMany(req.user.orgId, req.user.branchId, {
      status: status ? (status.split(',') as any[]) : undefined,
      purchaseOrderId,
      includeLines: includeLines === 'true',
      includePurchaseOrder: true,
    });
  }

  @Get('receipts/:id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getReceipt(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.receiptsService.findById(req.user.orgId, req.user.branchId, id);
  }

  @Post('receipts/:id/post')
  @HttpCode(HttpStatus.OK)
  @Roles('L3', 'L4', 'L5')
  async postReceipt(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.receiptsService.post(req.user.orgId, req.user.branchId, id, req.user.id);
  }

  @Post('receipts/:id/void')
  @HttpCode(HttpStatus.OK)
  @Roles('L4', 'L5')
  async voidReceipt(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: VoidReceiptDto,
  ): Promise<any> {
    return this.receiptsService.void(req.user.orgId, req.user.branchId, id, req.user.id, dto.reason);
  }

  // ============= Reporting & Exports =============

  @Get('reports/procurement-kpis')
  @Roles('L4', 'L5')
  async getProcurementKpis(@Req() req: any) {
    return this.reportingService.getKpis(req.user.orgId, req.user.branchId);
  }

  @Get('export/purchase-orders')
  @Roles('L4', 'L5')
  async exportPurchaseOrders(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.reportingService.exportPurchaseOrders(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        status: status ? status.split(',') : undefined,
      },
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'X-Nimbus-Export-Hash': result.hash,
      'X-Nimbus-Record-Count': result.recordCount.toString(),
    });

    res.send(result.data);
  }

  @Get('export/receipts')
  @Roles('L4', 'L5')
  async exportReceipts(
    @Req() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.reportingService.exportReceipts(
      req.user.orgId,
      req.user.branchId,
      {
        format: format === 'json' ? ExportFormat.JSON : ExportFormat.CSV,
        status: status ? status.split(',') : undefined,
      },
    );

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'X-Nimbus-Export-Hash': result.hash,
      'X-Nimbus-Record-Count': result.recordCount.toString(),
    });

    res.send(result.data);
  }
}
