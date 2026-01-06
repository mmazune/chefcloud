/**
 * M11.4 Inventory Depletion Controller
 * 
 * REST API for viewing and managing inventory depletions:
 * - RBAC: L3+ read, L4+ retry/skip
 * - List and filter depletions
 * - Retry failed depletions
 * - Skip failed depletions
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryDepletionService,
  DepletionQueryOptions,
} from './inventory-depletion.service';
import { DepletionStatus } from '@chefcloud/db';

@Controller('inventory/depletions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryDepletionController {
  constructor(private readonly depletionService: InventoryDepletionService) {}

  /**
   * List depletions with optional filters
   */
  @Get()
  @Roles('L3')
  async listDepletions(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<object> {
    const options: DepletionQueryOptions = {
      branchId: branchId || req.user.branchId,
      limit,
      offset,
    };

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',') as DepletionStatus[];
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (fromDate) {
      options.fromDate = new Date(fromDate);
    }

    if (toDate) {
      options.toDate = new Date(toDate);
    }

    return this.depletionService.list(req.user.orgId, options);
  }

  /**
   * Get depletion statistics
   */
  @Get('stats')
  @Roles('L3')
  async getStats(
    @Request() req: any,
    @Query('branchId') branchId?: string,
  ) {
    return this.depletionService.getStats(req.user.orgId, branchId || req.user.branchId);
  }

  /**
   * Get depletion by ID
   */
  @Get(':depletionId')
  @Roles('L3')
  async getDepletion(
    @Request() req: any,
    @Param('depletionId') depletionId: string,
  ): Promise<object | null> {
    return this.depletionService.getById(req.user.orgId, depletionId);
  }

  /**
   * Get depletion by order ID
   */
  @Get('order/:orderId')
  @Roles('L3')
  async getDepletionByOrder(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ): Promise<object | null> {
    return this.depletionService.getByOrderId(req.user.orgId, orderId);
  }

  /**
   * Retry a failed depletion
   */
  @Post(':depletionId/retry')
  @Roles('L4')
  async retryDepletion(
    @Request() req: any,
    @Param('depletionId') depletionId: string,
  ) {
    return this.depletionService.retry(req.user.orgId, depletionId, req.user.userId);
  }

  /**
   * Skip a failed depletion
   */
  @Post(':depletionId/skip')
  @Roles('L4')
  async skipDepletion(
    @Request() req: any,
    @Param('depletionId') depletionId: string,
    @Body() dto: { reason: string },
  ): Promise<object> {
    return this.depletionService.skip(
      req.user.orgId,
      depletionId,
      req.user.userId,
      dto.reason,
    );
  }

  /**
   * Manually trigger depletion for an order (admin/testing)
   */
  @Post('trigger/:orderId')
  @Roles('L5')
  async triggerDepletion(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    return this.depletionService.depleteForOrder(
      req.user.orgId,
      orderId,
      req.user.branchId,
      req.user.userId,
    );
  }
}
