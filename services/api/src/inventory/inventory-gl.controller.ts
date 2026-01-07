/**
 * M11.13 Inventory GL Posting Controller
 * 
 * Endpoints for:
 * - Posting mappings CRUD (L4+ for mutations, L3+ for reads)
 * - GL posting preview
 * - GL postings report and export
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { createHash } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  InventoryPostingMappingService,
  CreateInventoryPostingMappingDto,
  UpdateInventoryPostingMappingDto,
} from './inventory-posting-mapping.service';
import { InventoryGlPostingService } from './inventory-gl-posting.service';
import { PrismaService } from '../prisma.service';

@Controller('inventory/gl')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryGlController {
  constructor(
    private readonly mappingService: InventoryPostingMappingService,
    private readonly glPostingService: InventoryGlPostingService,
    private readonly prisma: PrismaService,
  ) {}

  // ================================================================
  // Posting Mappings CRUD
  // ================================================================

  @Get('mappings')
  async listMappings(@Req() req: any) {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }
    return this.mappingService.findAll(orgId);
  }

  @Get('mappings/:id')
  async getMapping(@Req() req: any, @Param('id') id: string) {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }
    return this.mappingService.findById(orgId, id);
  }

  @Post('mappings')
  async createMapping(@Req() req: any, @Body() dto: CreateInventoryPostingMappingDto) {
    const { orgId, userId, roleLevel } = req.user;
    if (roleLevel < 4) {
      throw new ForbiddenException('Owner role or higher required to create mappings');
    }
    return this.mappingService.create(orgId, userId, dto);
  }

  @Put('mappings/:id')
  async updateMapping(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryPostingMappingDto,
  ) {
    const { orgId, userId, roleLevel } = req.user;
    if (roleLevel < 4) {
      throw new ForbiddenException('Owner role or higher required to update mappings');
    }
    return this.mappingService.update(orgId, id, userId, dto);
  }

  @Delete('mappings/:id')
  async deleteMapping(@Req() req: any, @Param('id') id: string) {
    const { orgId, userId, roleLevel } = req.user;
    if (roleLevel < 4) {
      throw new ForbiddenException('Owner role or higher required to delete mappings');
    }
    return this.mappingService.delete(orgId, id, userId);
  }

  // ================================================================
  // GL Posting Preview
  // ================================================================

  @Get('preview')
  async previewPosting(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('documentType') documentType: 'GOODS_RECEIPT' | 'DEPLETION' | 'WASTE' | 'STOCKTAKE',
    @Query('amount') amount: string,
  ) {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }
    return this.glPostingService.previewPosting(orgId, branchId, documentType, parseFloat(amount));
  }

  // ================================================================
  // GL Postings Report
  // ================================================================

  @Get('postings')
  async listPostings(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('documentType') documentType?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ success: boolean; data: any[]; meta: { total: number; limit: number; offset: number } }> {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }

    // Build filter for inventory GL sources
    const inventorySources = [
      'INV_GOODS_RECEIPT',
      'INV_GOODS_RECEIPT_VOID',
      'INV_DEPLETION',
      'INV_WASTE',
      'INV_WASTE_VOID',
      'INV_STOCKTAKE',
      'INV_STOCKTAKE_VOID',
    ];

    const sourceFilter = documentType
      ? inventorySources.filter((s) => s.includes(documentType))
      : inventorySources;

    const where: any = {
      orgId,
      source: { in: sourceFilter },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    if (fromDate) {
      where.date = { ...(where.date ?? {}), gte: new Date(fromDate) };
    }
    if (toDate) {
      where.date = { ...(where.date ?? {}), lte: new Date(toDate) };
    }

    const [items, total] = await Promise.all([
      this.prisma.client.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
          reversalOf: { select: { id: true, source: true, sourceId: true } },
        },
        orderBy: { date: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      }),
      this.prisma.client.journalEntry.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        total,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    };
  }

  // ================================================================
  // GL Postings Export (CSV)
  // ================================================================

  @Get('postings/export')
  async exportPostings(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('documentType') documentType?: string,
    @Query('branchId') branchId?: string,
  ) {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }

    const inventorySources = [
      'INV_GOODS_RECEIPT',
      'INV_GOODS_RECEIPT_VOID',
      'INV_DEPLETION',
      'INV_WASTE',
      'INV_WASTE_VOID',
      'INV_STOCKTAKE',
      'INV_STOCKTAKE_VOID',
    ];

    const sourceFilter = documentType
      ? inventorySources.filter((s) => s.includes(documentType))
      : inventorySources;

    const where: any = {
      orgId,
      source: { in: sourceFilter },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    if (fromDate) {
      where.date = { ...(where.date ?? {}), gte: new Date(fromDate) };
    }
    if (toDate) {
      where.date = { ...(where.date ?? {}), lte: new Date(toDate) };
    }

    const journals = await this.prisma.client.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Build CSV
    const headers = [
      'Journal ID',
      'Date',
      'Source',
      'Source ID',
      'Memo',
      'Status',
      'Account Code',
      'Account Name',
      'Debit',
      'Credit',
    ];

    const rows: string[][] = [headers];

    for (const journal of journals) {
      for (const line of journal.lines) {
        rows.push([
          journal.id,
          journal.date.toISOString(),
          journal.source ?? '',
          journal.sourceId ?? '',
          journal.memo ?? '',
          journal.status,
          line.account.code,
          line.account.name,
          line.debit.toString(),
          line.credit.toString(),
        ]);
      }
    }

    // Generate CSV content (no BOM, consistent LF)
    const csvContent = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

    // Calculate hash
    const hash = createHash('sha256').update(csvContent).digest('hex');

    // Set response headers
    const filename = `inventory-gl-postings-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Hash', hash);

    res.send(csvContent);
  }

  // ================================================================
  // Check Mapping Status
  // ================================================================

  @Get('status')
  async checkGlStatus(@Req() req: any, @Query('branchId') branchId?: string) {
    const { orgId, roleLevel } = req.user;
    if (roleLevel < 3) {
      throw new ForbiddenException('Manager role or higher required');
    }

    const hasMapping = await this.mappingService.hasMappingForOrg(orgId);

    let resolvedMapping = null;
    if (branchId && hasMapping) {
      try {
        resolvedMapping = await this.mappingService.resolveMapping(orgId, branchId);
      } catch {
        // No mapping for this branch
      }
    }

    return {
      glIntegrationEnabled: hasMapping,
      mappingResolved: resolvedMapping !== null,
      isOrgDefault: resolvedMapping?.isOrgDefault ?? null,
    };
  }
}
