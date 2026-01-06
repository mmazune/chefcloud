import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryBarcodesService,
  CreateItemBarcodeDto,
  CreateLotBarcodeDto,
} from './inventory-barcodes.service';

interface AuthenticatedRequest {
  user: {
    sub: string;
    orgId: string;
    branchId: string;
  };
  headers: Record<string, string>;
}

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryBarcodesController {
  constructor(private readonly barcodesService: InventoryBarcodesService) {}

  // ============================================
  // Resolve Barcode (L2+)
  // ============================================

  @Get('barcodes/resolve')
  @Roles('L2_STAFF', 'L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async resolveBarcode(
    @Req() req: AuthenticatedRequest,
    @Query('value') value: string,
  ) {
    const { orgId } = this.extractContext(req);
    const result = await this.barcodesService.resolveBarcode(orgId, value);

    if (!result) {
      return { found: false, value };
    }

    return { found: true, ...result };
  }

  // ============================================
  // List All Barcodes (L3+)
  // ============================================

  @Get('barcodes')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async listAllBarcodes(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('type') type?: 'ITEM' | 'LOT',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = this.extractContext(req);
    return this.barcodesService.listAllBarcodes(orgId, {
      search,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ============================================
  // Export Barcodes CSV (L4+)
  // ============================================

  @Get('barcodes/export')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async exportBarcodes(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { orgId } = this.extractContext(req);
    const { csv, hash, filename } = await this.barcodesService.exportCsv(orgId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.status(HttpStatus.OK).send(csv);
  }

  // ============================================
  // Item Barcode CRUD
  // ============================================

  @Post('items/:itemId/barcodes')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async createItemBarcode(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: CreateItemBarcodeDto,
  ) {
    const { orgId, userId } = this.extractContext(req);
    return this.barcodesService.createItemBarcode(orgId, itemId, userId, dto);
  }

  @Get('items/:itemId/barcodes')
  @Roles('L2_STAFF', 'L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async listItemBarcodes(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    const { orgId } = this.extractContext(req);
    return this.barcodesService.listItemBarcodes(orgId, itemId);
  }

  @Delete('items/:itemId/barcodes/:barcodeId')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async deleteItemBarcode(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Param('barcodeId') barcodeId: string,
  ) {
    const { orgId } = this.extractContext(req);
    return this.barcodesService.deleteItemBarcode(orgId, itemId, barcodeId);
  }

  // ============================================
  // Lot Barcode CRUD
  // ============================================

  @Post('lots/:lotId/barcodes')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async createLotBarcode(
    @Req() req: AuthenticatedRequest,
    @Param('lotId') lotId: string,
    @Body() dto: CreateLotBarcodeDto,
  ) {
    const { orgId, userId } = this.extractContext(req);
    return this.barcodesService.createLotBarcode(orgId, lotId, userId, dto);
  }

  @Get('lots/:lotId/barcodes')
  @Roles('L2_STAFF', 'L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async listLotBarcodes(
    @Req() req: AuthenticatedRequest,
    @Param('lotId') lotId: string,
  ) {
    const { orgId } = this.extractContext(req);
    return this.barcodesService.listLotBarcodes(orgId, lotId);
  }

  @Delete('lots/:lotId/barcodes/:barcodeId')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async deleteLotBarcode(
    @Req() req: AuthenticatedRequest,
    @Param('lotId') lotId: string,
    @Param('barcodeId') barcodeId: string,
  ) {
    const { orgId } = this.extractContext(req);
    return this.barcodesService.deleteLotBarcode(orgId, lotId, barcodeId);
  }

  // ============================================
  // Helper
  // ============================================

  private extractContext(req: AuthenticatedRequest) {
    const user = req.user;
    return {
      orgId: user.orgId,
      branchId: req.headers['x-branch-id'] || user.branchId,
      userId: user.sub,
    };
  }
}
