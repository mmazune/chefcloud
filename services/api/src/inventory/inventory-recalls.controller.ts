/**
 * M11.8 Recalls Controller
 *
 * Endpoints:
 * - GET /inventory/recalls - List recall cases
 * - GET /inventory/recalls/:id - Get recall case details
 * - GET /inventory/recalls/:id/impact - Get recall impact report
 * - POST /inventory/recalls - Create recall case
 * - POST /inventory/recalls/:id/link-lot - Link lot to recall
 * - POST /inventory/recalls/:id/unlink-lot - Unlink lot from recall
 * - POST /inventory/recalls/:id/close - Close recall case
 * - GET /inventory/recalls/:id/export - Export recall impact to CSV
 * - GET /inventory/recalls/recalled-lots - Get all lots under active recall
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
import { Roles } from '../auth/roles.decorator';
import { InventoryRecallsService } from './inventory-recalls.service';
import { RecallCaseStatus } from '@chefcloud/db';

interface ListRecallsQuery {
  branchId?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

interface CreateRecallDto {
  branchId?: string; // Optional - null means org-wide
  reason: string;
  notes?: string;
}

interface LinkLotDto {
  lotId: string;
}

interface CloseRecallDto {
  notes?: string;
}

interface RecalledLotsQuery {
  branchId?: string;
  itemId?: string;
}

@Controller('inventory/recalls')
@UseGuards(JwtAuthGuard)
export class InventoryRecallsController {
  constructor(private readonly recallsService: InventoryRecallsService) {}

  /**
   * GET /inventory/recalls
   * List recall cases with optional filters
   */
  @Get()
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async listRecalls(
    @Req() req: Request,
    @Query() query: ListRecallsQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const statusInput = query.status;
    let status: RecallCaseStatus | RecallCaseStatus[] | undefined;
    if (statusInput) {
      if (statusInput.includes(',')) {
        status = statusInput.split(',').map((s) => s.trim() as RecallCaseStatus);
      } else {
        status = statusInput as RecallCaseStatus;
      }
    }

    const { cases, total } = await this.recallsService.listRecallCases({
      orgId,
      branchId: query.branchId,
      status,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      items: cases.map((c) => ({
        ...c,
        totalAffectedQty: c.totalAffectedQty.toNumber(),
      })),
      total,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
  }

  /**
   * GET /inventory/recalls/recalled-lots
   * Get all lots under active recall
   */
  @Get('recalled-lots')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getRecalledLots(
    @Req() req: Request,
    @Query() query: RecalledLotsQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const lots = await this.recallsService.getRecalledLots({
      orgId,
      branchId: query.branchId,
      itemId: query.itemId,
    });

    return {
      items: lots,
      total: lots.length,
    };
  }

  /**
   * GET /inventory/recalls/:id
   * Get recall case details
   */
  @Get(':id')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getRecall(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const recallCase = await this.recallsService.getRecallCase(id, orgId);
    if (!recallCase) {
      throw new NotFoundException('Recall case not found');
    }

    return {
      ...recallCase,
      totalAffectedQty: recallCase.totalAffectedQty.toNumber(),
      linkedLots: recallCase.linkedLots.map((l) => ({
        ...l,
        remainingQty: l.remainingQty.toNumber(),
      })),
    };
  }

  /**
   * GET /inventory/recalls/:id/impact
   * Get recall impact report
   */
  @Get(':id/impact')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getRecallImpact(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const impact = await this.recallsService.getRecallImpact(id, orgId);
    if (!impact) {
      throw new NotFoundException('Recall case not found');
    }

    return {
      ...impact,
      totalQtyBlocked: impact.totalQtyBlocked.toNumber(),
      itemsAffected: impact.itemsAffected.map((i) => ({
        ...i,
        qtyBlocked: i.qtyBlocked.toNumber(),
      })),
      locationsAffected: impact.locationsAffected.map((l) => ({
        ...l,
        qtyBlocked: l.qtyBlocked.toNumber(),
      })),
    };
  }

  /**
   * POST /inventory/recalls
   * Create a recall case
   */
  @Post()
  @Roles('L3', 'L4', 'L5') // L3+ can create
  @HttpCode(HttpStatus.CREATED)
  async createRecall(
    @Req() req: Request,
    @Body() body: CreateRecallDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.sub;
    if (!orgId) throw new NotFoundException('Organization not found');

    if (!body.reason || body.reason.trim().length === 0) {
      throw new BadRequestException('Recall reason is required');
    }

    const result = await this.recallsService.createRecallCase({
      orgId,
      branchId: body.branchId,
      reason: body.reason,
      createdById: userId,
      notes: body.notes,
    });

    return {
      id: result.id,
      caseNumber: result.caseNumber,
      status: 'OPEN',
    };
  }

  /**
   * POST /inventory/recalls/:id/link-lot
   * Link a lot to a recall case (blocks FEFO allocation)
   */
  @Post(':id/link-lot')
  @Roles('L3', 'L4', 'L5') // L3+ can link
  @HttpCode(HttpStatus.OK)
  async linkLot(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: LinkLotDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.sub;
    if (!orgId) throw new NotFoundException('Organization not found');

    if (!body.lotId) {
      throw new BadRequestException('Lot ID is required');
    }

    await this.recallsService.linkLot(id, body.lotId, orgId, userId);

    return { success: true, linked: true };
  }

  /**
   * POST /inventory/recalls/:id/unlink-lot
   * Unlink a lot from a recall case
   */
  @Post(':id/unlink-lot')
  @Roles('L3', 'L4', 'L5') // L3+ can unlink
  @HttpCode(HttpStatus.OK)
  async unlinkLot(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: LinkLotDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.sub;
    if (!orgId) throw new NotFoundException('Organization not found');

    if (!body.lotId) {
      throw new BadRequestException('Lot ID is required');
    }

    await this.recallsService.unlinkLot(id, body.lotId, orgId, userId);

    return { success: true, unlinked: true };
  }

  /**
   * POST /inventory/recalls/:id/close
   * Close a recall case
   */
  @Post(':id/close')
  @Roles('L4', 'L5') // L4+ can close (significant action)
  @HttpCode(HttpStatus.OK)
  async closeRecall(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: CloseRecallDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.sub;
    if (!orgId) throw new NotFoundException('Organization not found');

    await this.recallsService.closeRecallCase(id, orgId, userId, body.notes);

    return { success: true, status: 'CLOSED' };
  }

  /**
   * GET /inventory/recalls/:id/export
   * Export recall impact to CSV
   */
  @Get(':id/export')
  @Roles('L4', 'L5') // L4+ can export
  async exportRecallImpact(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ): Promise<void> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const result = await this.recallsService.exportRecallImpact(id, orgId);
    if (!result) {
      throw new NotFoundException('Recall case not found');
    }

    const { csv, hash } = result;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recall-impact-${id}-${Date.now()}.csv"`,
    );
    res.setHeader('X-Content-Hash', hash);
    res.send(csv);
  }
}
