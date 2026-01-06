/**
 * M11.8 Vendor Returns Controller
 *
 * Endpoints:
 * - GET /inventory/vendor-returns - List vendor returns
 * - GET /inventory/vendor-returns/:id - Get vendor return details
 * - POST /inventory/vendor-returns - Create vendor return (DRAFT)
 * - POST /inventory/vendor-returns/:id/submit - Submit (DRAFT → SUBMITTED)
 * - POST /inventory/vendor-returns/:id/post - Post (SUBMITTED → POSTED) with FEFO
 * - POST /inventory/vendor-returns/:id/void - Void vendor return
 * - GET /inventory/vendor-returns/export - Export to CSV
 */
import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    Body,
    Req,
    Res,
    UseGuards,
    NotFoundException,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
    InventoryVendorReturnsService,
    CreateVendorReturnInput,
} from './inventory-vendor-returns.service';
import { VendorReturnStatus } from '@chefcloud/db';

interface ListReturnsQuery {
    branchId?: string;
    vendorId?: string;
    status?: string;
    limit?: string;
    offset?: string;
}

interface CreateReturnDto {
    branchId: string;
    vendorId: string;
    notes?: string;
    lines: {
        itemId: string;
        locationId: string;
        requestedBaseQty: number;
        uomId?: string;
        lotId?: string;
        unitCost?: number;
        reason?: string;
    }[];
}

interface VoidReturnDto {
    reason: string;
}

interface ExportQuery {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
}

@Controller('inventory/vendor-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryVendorReturnsController {
    constructor(
        private readonly vendorReturnsService: InventoryVendorReturnsService,
    ) { }

    /**
     * GET /inventory/vendor-returns
     * List vendor returns with optional filters
     */
    @Get()
    @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
    async listReturns(
        @Req() req: Request,
        @Query() query: ListReturnsQuery,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        if (!orgId) throw new NotFoundException('Organization not found');

        const statusInput = query.status;
        let status: VendorReturnStatus | VendorReturnStatus[] | undefined;
        if (statusInput) {
            if (statusInput.includes(',')) {
                status = statusInput.split(',').map((s) => s.trim() as VendorReturnStatus);
            } else {
                status = statusInput as VendorReturnStatus;
            }
        }

        const { returns, total } = await this.vendorReturnsService.listReturns({
            orgId,
            branchId: query.branchId,
            vendorId: query.vendorId,
            status,
            limit: query.limit ? parseInt(query.limit, 10) : 50,
            offset: query.offset ? parseInt(query.offset, 10) : 0,
        });

        return {
            items: returns.map((r) => ({
                ...r,
                totalRequestedQty: r.totalRequestedQty.toNumber(),
                totalPostedQty: r.totalPostedQty.toNumber(),
            })),
            total,
            limit: query.limit ? parseInt(query.limit, 10) : 50,
            offset: query.offset ? parseInt(query.offset, 10) : 0,
        };
    }

    /**
     * GET /inventory/vendor-returns/export
     * Export vendor returns to CSV
     * NOTE: Must be defined BEFORE :id route to avoid matching 'export' as an ID
     */
    @Get('export')
    @Roles('L4', 'L5') // L4+ can export
    async exportReturns(
        @Req() req: Request,
        @Res() res: Response,
        @Query() query: ExportQuery,
    ): Promise<void> {
        const orgId = (req as any).user?.orgId;
        if (!orgId) throw new NotFoundException('Organization not found');

        const statusInput = query.status;
        let status: VendorReturnStatus[] | undefined;
        if (statusInput) {
            status = statusInput.split(',').map((s) => s.trim() as VendorReturnStatus);
        }

        const { csv, hash } = await this.vendorReturnsService.exportReturns({
            orgId,
            branchId: query.branchId,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            status,
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="vendor-returns-${Date.now()}.csv"`,
        );
        res.setHeader('X-Content-Hash', hash);
        res.send(csv);
    }

    /**
     * GET /inventory/vendor-returns/:id
     * Get vendor return details
     */
    @Get(':id')
    @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
    async getReturn(
        @Req() req: Request,
        @Param('id') id: string,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        if (!orgId) throw new NotFoundException('Organization not found');

        const vendorReturn = await this.vendorReturnsService.getReturn(id, orgId);
        if (!vendorReturn) {
            throw new NotFoundException('Vendor return not found');
        }

        return {
            ...vendorReturn,
            totalRequestedQty: vendorReturn.totalRequestedQty.toNumber(),
            totalPostedQty: vendorReturn.totalPostedQty.toNumber(),
            lines: vendorReturn.lines.map((l) => ({
                ...l,
                requestedBaseQty: l.requestedBaseQty.toNumber(),
                postedBaseQty: l.postedBaseQty.toNumber(),
                unitCost: l.unitCost?.toNumber() ?? null,
            })),
        };
    }

    /**
     * POST /inventory/vendor-returns
     * Create a vendor return in DRAFT status
     */
    @Post()
    @Roles('L3', 'L4', 'L5') // L3+ can create
    @HttpCode(HttpStatus.CREATED)
    async createReturn(
        @Req() req: Request,
        @Body() body: CreateReturnDto,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        const userId = (req as any).user?.userId;
        if (!orgId) throw new NotFoundException('Organization not found');

        if (!body.lines || body.lines.length === 0) {
            throw new BadRequestException('At least one line is required');
        }

        const input: CreateVendorReturnInput = {
            orgId,
            branchId: body.branchId,
            vendorId: body.vendorId,
            createdById: userId,
            notes: body.notes,
            lines: body.lines.map((l) => ({
                itemId: l.itemId,
                locationId: l.locationId,
                requestedBaseQty: l.requestedBaseQty,
                uomId: l.uomId,
                lotId: l.lotId,
                unitCost: l.unitCost,
                reason: l.reason,
            })),
        };

        const result = await this.vendorReturnsService.createReturn(input);

        return {
            id: result.id,
            returnNumber: result.returnNumber,
            status: 'DRAFT',
        };
    }

    /**
     * POST /inventory/vendor-returns/:id/submit
     * Submit vendor return (DRAFT → SUBMITTED)
     */
    @Post(':id/submit')
    @Roles('L3', 'L4', 'L5') // L3+ can submit
    @HttpCode(HttpStatus.OK)
    async submitReturn(
        @Req() req: Request,
        @Param('id') id: string,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        const userId = (req as any).user?.userId;
        if (!orgId) throw new NotFoundException('Organization not found');

        await this.vendorReturnsService.submitReturn(id, orgId, userId);

        return { success: true, status: 'SUBMITTED' };
    }

    /**
     * POST /inventory/vendor-returns/:id/post
     * Post vendor return (SUBMITTED → POSTED) with FEFO allocation
     */
    @Post(':id/post')
    @Roles('L4', 'L5') // L4+ can post (financially significant)
    @HttpCode(HttpStatus.OK)
    async postReturn(
        @Req() req: Request,
        @Param('id') id: string,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        const userId = (req as any).user?.userId;
        const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

        if (!orgId) throw new NotFoundException('Organization not found');

        const result = await this.vendorReturnsService.postReturn(
            id,
            orgId,
            userId,
            idempotencyKey,
        );

        if (!result.posted) {
            // Idempotent response - already posted
            return { success: true, status: 'POSTED', alreadyPosted: true };
        }

        return {
            success: true,
            status: 'POSTED',
            allocations: result.allocations.map((a) => ({
                lineId: a.lineId,
                lotId: a.lotId,
                qty: a.qty.toNumber(),
            })),
        };
    }

    /**
     * POST /inventory/vendor-returns/:id/void
     * Void vendor return (reverses POSTED or cancels DRAFT/SUBMITTED)
     */
    @Post(':id/void')
    @Roles('L4', 'L5') // L4+ can void (financially significant)
    @HttpCode(HttpStatus.OK)
    async voidReturn(
        @Req() req: Request,
        @Param('id') id: string,
        @Body() body: VoidReturnDto,
    ): Promise<object> {
        const orgId = (req as any).user?.orgId;
        const userId = (req as any).user?.userId;
        if (!orgId) throw new NotFoundException('Organization not found');

        if (!body.reason || body.reason.trim().length === 0) {
            throw new BadRequestException('Void reason is required');
        }

        await this.vendorReturnsService.voidReturn(id, orgId, userId, body.reason);

        return { success: true, status: 'VOID' };
    }
}
