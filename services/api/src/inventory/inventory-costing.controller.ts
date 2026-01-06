/**
 * M11.5 Inventory Costing Controller
 * 
 * Endpoints for:
 * - GET /inventory/valuation - Branch inventory valuation
 * - GET /inventory/valuation/export - CSV export with BOM + hash
 * - GET /inventory/cogs - COGS report for date range
 * - GET /inventory/cogs/export - CSV export with BOM + hash
 * - GET /inventory/items/:itemId/cost-history - Cost layer history
 * - POST /inventory/items/:itemId/seed-cost - Manual initial cost seed
 * 
 * RBAC: L4+ (MANAGER, OWNER, ADMIN)
 */
import {
    Controller,
    Get,
    Post,
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
import { InventoryCostingService, ValuationSummary, CogsSummary } from './inventory-costing.service';
import { createHash } from 'crypto';
import { Prisma } from '@chefcloud/db';

type Decimal = Prisma.Decimal;

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\ufeff';

// Helper to format Decimal for display (4 decimal places)
function formatDecimal(d: Decimal): string {
    return Number(d).toFixed(4);
}

// Helper to format Decimal for currency (2 decimal places)
function formatCurrency(d: Decimal): string {
    return Number(d).toFixed(2);
}

// Helper to format date as ISO string
function formatDate(d: Date): string {
    return d.toISOString();
}

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryCostingController {
    constructor(private readonly costingService: InventoryCostingService) { }

    /**
     * GET /inventory/valuation
     * Get current inventory valuation for a branch
     */
    @Get('valuation')
    @Roles('L4')
    async getValuation(
        @Request() req: any,
        @Query('categoryId') categoryId?: string,
        @Query('includeZeroStock') includeZeroStock?: string,
    ): Promise<{
        success: boolean;
        data: ValuationSummary;
    }> {
        const result = await this.costingService.getValuation(req.user.orgId, req.user.branchId, {
            categoryId,
            includeZeroStock: includeZeroStock === 'true',
        });

        return { success: true, data: result };
    }

    /**
     * GET /inventory/valuation/export
     * Export valuation as CSV with UTF-8 BOM and X-Nimbus-Export-Hash
     */
    @Get('valuation/export')
    @Roles('L4')
    async exportValuation(
        @Request() req: any,
        @Query('categoryId') categoryId?: string,
        @Query('includeZeroStock') includeZeroStock?: string,
        @Res() res?: Response,
    ): Promise<void> {
        if (!res) throw new BadRequestException('Response object required');

        const result = await this.costingService.getValuation(req.user.orgId, req.user.branchId, {
            categoryId,
            includeZeroStock: includeZeroStock === 'true',
        });

        // Build CSV content (LF line endings, no BOM yet)
        const header = 'Item Code,Item Name,Category,On-Hand Qty,WAC,Total Value,Last Cost Update';
        const rows = result.lines.map((line) =>
            [
                `"${line.itemCode}"`,
                `"${line.itemName}"`,
                `"${line.categoryName ?? ''}"`,
                formatDecimal(line.onHandQty),
                formatCurrency(line.wac),
                formatCurrency(line.totalValue),
                line.lastCostLayerAt ? formatDate(line.lastCostLayerAt) : '',
            ].join(','),
        );

        // Add summary row
        rows.push('');
        rows.push(`"Total",,,"${result.itemCount} items",,${formatCurrency(result.totalValue)},${formatDate(result.asOfDate)}`);

        const csvContent = [header, ...rows].join('\n');

        // Compute hash on normalized LF content before BOM
        const hash = createHash('sha256').update(csvContent, 'utf8').digest('hex');

        // Add BOM for Excel compatibility
        const csvWithBom = UTF8_BOM + csvContent;

        // Set headers
        const filename = `valuation_${result.branchName.replace(/\s+/g, '_')}_${result.asOfDate.toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Nimbus-Export-Hash', hash);

        res.send(csvWithBom);
    }

    /**
     * GET /inventory/cogs
     * Get COGS report for a date range
     */
    @Get('cogs')
    @Roles('L4')
    async getCogs(
        @Request() req: any,
        @Query('fromDate') fromDateStr: string,
        @Query('toDate') toDateStr: string,
        @Query('categoryId') categoryId?: string,
    ): Promise<{
        success: boolean;
        data: CogsSummary;
    }> {
        if (!fromDateStr || !toDateStr) {
            throw new BadRequestException('fromDate and toDate are required');
        }

        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new BadRequestException('Invalid date format');
        }

        const result = await this.costingService.getCogsReport(req.user.orgId, req.user.branchId, fromDate, toDate, {
            categoryId,
        });

        return { success: true, data: result };
    }

    /**
     * GET /inventory/cogs/export
     * Export COGS as CSV with UTF-8 BOM and X-Nimbus-Export-Hash
     */
    @Get('cogs/export')
    @Roles('L4')
    async exportCogs(
        @Request() req: any,
        @Query('fromDate') fromDateStr: string,
        @Query('toDate') toDateStr: string,
        @Query('categoryId') categoryId?: string,
        @Res() res?: Response,
    ): Promise<void> {
        if (!res) throw new BadRequestException('Response object required');

        if (!fromDateStr || !toDateStr) {
            throw new BadRequestException('fromDate and toDate are required');
        }

        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new BadRequestException('Invalid date format');
        }

        const result = await this.costingService.getCogsReport(req.user.orgId, req.user.branchId, fromDate, toDate, {
            categoryId,
        });

        // Build CSV content (LF line endings, no BOM yet)
        const header = 'Order ID,Item Code,Item Name,Qty Depleted,Unit Cost,Line COGS,Depleted At';
        const rows = result.lines.map((line) =>
            [
                `"${line.orderId}"`,
                `"${line.itemCode}"`,
                `"${line.itemName}"`,
                formatDecimal(line.qtyDepleted),
                formatCurrency(line.unitCost),
                formatCurrency(line.lineCogs),
                formatDate(line.depletedAt),
            ].join(','),
        );

        // Add summary row
        rows.push('');
        rows.push(`"Total",,,"${result.lineCount} lines",,${formatCurrency(result.totalCogs)},`);

        const csvContent = [header, ...rows].join('\n');

        // Compute hash on normalized LF content before BOM
        const hash = createHash('sha256').update(csvContent, 'utf8').digest('hex');

        // Add BOM for Excel compatibility
        const csvWithBom = UTF8_BOM + csvContent;

        // Set headers
        const filename = `cogs_${result.branchName.replace(/\s+/g, '_')}_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Nimbus-Export-Hash', hash);

        res.send(csvWithBom);
    }

    /**
     * GET /inventory/items/:itemId/cost-history
     * Get cost layer history for an item
     */
    @Get('items/:itemId/cost-history')
    @Roles('L4')
    async getCostHistory(
        @Request() req: any,
        @Param('itemId') itemId: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        const result = await this.costingService.getCostLayerHistory(req.user.orgId, req.user.branchId, itemId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });

        return { success: true, data: result };
    }

    /**
     * POST /inventory/items/:itemId/seed-cost
     * Manually seed initial cost for an item (L4+ only)
     */
    @Post('items/:itemId/seed-cost')
    @Roles('L4')
    async seedCost(
        @Request() req: any,
        @Param('itemId') itemId: string,
        @Body() body: { unitCost: number | string; notes?: string },
    ) {
        if (body.unitCost === undefined || body.unitCost === null) {
            throw new BadRequestException('unitCost is required');
        }

        const result = await this.costingService.seedInitialCost(
            req.user.orgId,
            req.user.branchId,
            req.user.id,
            itemId,
            body.unitCost,
            body.notes,
        );

        return {
            success: true,
            data: {
                id: result.id,
                priorWac: Number(result.priorWac),
                newWac: Number(result.newWac),
            },
        };
    }
}
