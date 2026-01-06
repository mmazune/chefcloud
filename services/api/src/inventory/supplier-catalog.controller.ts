/**
 * M11.6 Supplier Catalog Controller
 * 
 * Endpoints for:
 * - Supplier Items CRUD
 * - Supplier Price management
 * - Reorder Policies CRUD
 * - Reorder Suggestion Runs
 * - Draft PO Generation
 * - CSV Exports
 * 
 * RBAC: L4+ for write, L2+ for read
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupplierCatalogService, CreateSupplierItemDto, UpdateSupplierItemDto } from './supplier-catalog.service';
import { SupplierPricingService, AddPriceDto } from './supplier-pricing.service';
import { ReorderEngineService, ReorderPolicyDto } from './reorder-engine.service';
import { ReorderPoGeneratorService } from './reorder-po-generator.service';
import { createHash } from 'crypto';
import { Prisma } from '@chefcloud/db';

type Decimal = Prisma.Decimal;

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\ufeff';

// Format helpers
function formatDecimal(d: Decimal | number): string {
  return Number(d).toFixed(4);
}

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SupplierCatalogController {
  constructor(
    private readonly catalogService: SupplierCatalogService,
    private readonly pricingService: SupplierPricingService,
    private readonly reorderEngine: ReorderEngineService,
    private readonly poGenerator: ReorderPoGeneratorService,
  ) { }

  // ============================================================================
  // Supplier Items
  // ============================================================================

  /**
   * POST /inventory/suppliers/items
   * Create a new supplier item
   */
  @Post('suppliers/items')
  @Roles('L4')
  async createSupplierItem(
    @Request() req: any,
    @Body() dto: CreateSupplierItemDto,
  ) {
    const result = await this.catalogService.create(req.user.orgId, req.user.branchId, req.user.id, dto);
    return { success: true, data: result };
  }

  /**
   * GET /inventory/suppliers/items
   * List supplier items
   */
  @Get('suppliers/items')
  @Roles('L2')
  async listSupplierItems(
    @Request() req: any,
    @Query('vendorId') vendorId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('isActive') isActive?: string,
    @Query('isPreferred') isPreferred?: string,
  ) {
    const result = await this.catalogService.findMany(req.user.orgId, {
      vendorId,
      inventoryItemId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isPreferred: isPreferred !== undefined ? isPreferred === 'true' : undefined,
    });
    return { success: true, data: result };
  }

  /**
   * GET /inventory/suppliers/items/:id
   * Get supplier item by ID
   */
  @Get('suppliers/items/:id')
  @Roles('L2')
  async getSupplierItem(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const result = await this.catalogService.findById(req.user.orgId, id);
    return { success: true, data: result };
  }

  /**
   * PATCH /inventory/suppliers/items/:id
   * Update supplier item
   */
  @Patch('suppliers/items/:id')
  @Roles('L4')
  async updateSupplierItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierItemDto,
  ) {
    const result = await this.catalogService.update(req.user.orgId, req.user.branchId, id, req.user.id, dto);
    return { success: true, data: result };
  }

  // ============================================================================
  // Supplier Prices
  // ============================================================================

  /**
   * POST /inventory/suppliers/items/:id/prices
   * Add a price for a supplier item
   */
  @Post('suppliers/items/:id/prices')
  @Roles('L4')
  async addPrice(
    @Request() req: any,
    @Param('id') supplierItemId: string,
    @Body() dto: AddPriceDto,
  ) {
    const result = await this.pricingService.addPrice(
      req.user.orgId,
      req.user.branchId,
      supplierItemId,
      req.user.id,
      dto,
    );
    return { success: true, data: result };
  }

  /**
   * GET /inventory/suppliers/items/:id/prices
   * Get price history for a supplier item
   */
  @Get('suppliers/items/:id/prices')
  @Roles('L2')
  async getPriceHistory(
    @Request() req: any,
    @Param('id') supplierItemId: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.pricingService.getPriceHistory(
      req.user.orgId,
      supplierItemId,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { success: true, data: result };
  }

  // ============================================================================
  // Reorder Policies
  // ============================================================================

  /**
   * POST /inventory/reorder/policies
   * Create or update a reorder policy
   */
  @Post('reorder/policies')
  @Roles('L4')
  async upsertReorderPolicy(
    @Request() req: any,
    @Body() dto: ReorderPolicyDto,
  ) {
    const result = await this.reorderEngine.upsertPolicy(
      req.user.orgId,
      req.user.branchId,
      req.user.id,
      dto,
    );
    return { success: true, data: result };
  }

  /**
   * GET /inventory/reorder/policies
   * List reorder policies for branch
   */
  @Get('reorder/policies')
  @Roles('L2')
  async listReorderPolicies(@Request() req: any) {
    const result = await this.reorderEngine.listPolicies(req.user.orgId, req.user.branchId);
    return { success: true, data: result };
  }

  /**
   * PATCH /inventory/reorder/policies/:id
   * Update a reorder policy (just calls upsert)
   */
  @Patch('reorder/policies/:id')
  @Roles('L4')
  async updateReorderPolicy(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<ReorderPolicyDto>,
  ) {
    // Get existing policy to get itemId
    const existing = await this.reorderEngine.getPolicy(req.user.orgId, req.user.branchId, dto.inventoryItemId ?? '');
    if (!existing && !dto.inventoryItemId) {
      throw new BadRequestException('inventoryItemId required');
    }

    const result = await this.reorderEngine.upsertPolicy(
      req.user.orgId,
      req.user.branchId,
      req.user.id,
      {
        inventoryItemId: dto.inventoryItemId ?? existing?.inventoryItemId ?? '',
        reorderPointBaseQty: dto.reorderPointBaseQty ?? (existing?.reorderPointBaseQty ? Number(existing.reorderPointBaseQty) : 0),
        reorderQtyBaseQty: dto.reorderQtyBaseQty ?? (existing?.reorderQtyBaseQty ? Number(existing.reorderQtyBaseQty) : 0),
        preferredLocationId: dto.preferredLocationId,
        preferredVendorId: dto.preferredVendorId,
        isActive: dto.isActive,
      },
    );
    return { success: true, data: result };
  }

  // ============================================================================
  // Reorder Suggestion Runs
  // ============================================================================

  /**
   * POST /inventory/reorder/runs
   * Create a new reorder suggestion run (or return existing by hash)
   */
  @Post('reorder/runs')
  @Roles('L4')
  async createReorderRun(
    @Request() req: any,
    @Body() body?: { itemIds?: string[] },
  ) {
    const result = await this.reorderEngine.createRun(
      req.user.orgId,
      req.user.branchId,
      req.user.id,
      { itemIds: body?.itemIds },
    );
    return { success: true, data: result };
  }

  /**
   * GET /inventory/reorder/runs
   * List recent runs
   */
  @Get('reorder/runs')
  @Roles('L4')
  async listReorderRuns(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const result = await this.reorderEngine.listRuns(
      req.user.orgId,
      req.user.branchId,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { success: true, data: result };
  }

  /**
   * GET /inventory/reorder/runs/:id
   * Get a run with lines
   */
  @Get('reorder/runs/:id')
  @Roles('L4')
  async getReorderRun(
    @Request() req: any,
    @Param('id') runId: string,
  ) {
    const result = await this.reorderEngine.getRun(req.user.orgId, runId);
    return { success: true, data: result };
  }

  /**
   * POST /inventory/reorder/runs/:id/generate-pos
   * Generate draft POs from a run (idempotent)
   * H7: Requires L4+
   */
  @Post('reorder/runs/:id/generate-pos')
  @Roles('L4')
  async generatePOs(
    @Request() req: any,
    @Param('id') runId: string,
  ) {
    const result = await this.poGenerator.generatePOs(req.user.orgId, runId, req.user.id);
    return { success: true, data: result };
  }

  /**
   * GET /inventory/reorder/runs/:id/pos
   * Get POs generated from a run
   */
  @Get('reorder/runs/:id/pos')
  @Roles('L4')
  async getRunPOs(
    @Request() req: any,
    @Param('id') runId: string,
  ) {
    const result = await this.poGenerator.getPOsForRun(req.user.orgId, runId);
    return { success: true, data: result };
  }

  // ============================================================================
  // Exports
  // ============================================================================

  /**
   * GET /inventory/export/supplier-items
   * Export supplier items as CSV
   */
  @Get('export/supplier-items')
  @Roles('L4')
  async exportSupplierItems(
    @Request() req: any,
    @Res() res: Response,
  ) {
    const items = await this.catalogService.findMany(req.user.orgId);

    const header = 'Vendor,Vendor SKU,Item Name,Item SKU,Pack Size,Conversion Factor,Lead Time Days,Min Order Qty,Preferred,Active';
    const rows = items.map((item) =>
      [
        `"${item.vendor.name}"`,
        `"${item.vendorSku}"`,
        `"${item.inventoryItem.name}"`,
        `"${item.inventoryItem.sku ?? ''}"`,
        `"${item.packSizeLabel ?? ''}"`,
        formatDecimal(item.uomConversionFactorToBase),
        item.leadTimeDays,
        formatDecimal(item.minOrderQtyVendorUom),
        item.isPreferred ? 'Yes' : 'No',
        item.isActive ? 'Yes' : 'No',
      ].join(','),
    );

    const csvContent = [header, ...rows].join('\n');
    const hash = createHash('sha256').update(csvContent, 'utf8').digest('hex');
    const csvWithBom = UTF8_BOM + csvContent;

    const filename = `supplier_items_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csvWithBom);
  }

  /**
   * GET /inventory/export/reorder-suggestions/:runId
   * Export reorder suggestions as CSV
   */
  @Get('export/reorder-suggestions/:runId')
  @Roles('L4')
  async exportReorderSuggestions(
    @Request() req: any,
    @Param('runId') runId: string,
    @Res() res: Response,
  ) {
    const run = await this.reorderEngine.getRun(req.user.orgId, runId);
    const lines = (run as any).lines ?? [];

    const header = 'Item Name,Item SKU,On Hand Qty,Reorder Point,Suggested Qty,Vendor,Vendor Qty,Reason';
    const rows = lines.map((line: any) =>
      [
        `"${line.inventoryItem.name}"`,
        `"${line.inventoryItem.sku ?? ''}"`,
        formatDecimal(line.onHandBaseQty),
        formatDecimal(line.reorderPointBaseQty),
        formatDecimal(line.suggestedBaseQty),
        `"${line.suggestedVendor?.name ?? ''}"`,
        line.suggestedVendorQty ? formatDecimal(line.suggestedVendorQty) : '',
        line.reasonCode,
      ].join(','),
    );

    const csvContent = [header, ...rows].join('\n');
    const hash = createHash('sha256').update(csvContent, 'utf8').digest('hex');
    const csvWithBom = UTF8_BOM + csvContent;

    const filename = `reorder_suggestions_${runId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csvWithBom);
  }
}
