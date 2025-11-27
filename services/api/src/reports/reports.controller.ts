/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import {
  SubscriptionService,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './subscription.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private subscriptionService: SubscriptionService,
  ) {}

  @Get('x')
  @Roles('L3')
  async getXReport(@Req() req: any): Promise<any> {
    return this.reportsService.getXReport(req.user.branchId);
  }

  @Get('z/:shiftId')
  @Roles('L4')
  async getZReport(@Param('shiftId') shiftId: string, @Req() req: any): Promise<any> {
    return this.reportsService.getZReport(req.user.branchId, shiftId);
  }

  // M4: Subscription Management Endpoints

  /**
   * Get all report subscriptions
   * RBAC: OWNER, MANAGER, ACCOUNTANT
   */
  @Get('subscriptions')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getSubscriptions(@Req() req: any, @Query('branchId') branchId?: string): Promise<any> {
    return this.subscriptionService.getSubscriptions(req.user.orgId, branchId);
  }

  /**
   * Create a new report subscription
   * RBAC: OWNER, MANAGER
   */
  @Post('subscriptions')
  @Roles('L4', 'L5')
  async createSubscription(@Req() req: any, @Body() dto: CreateSubscriptionDto): Promise<any> {
    return this.subscriptionService.createSubscription(req.user.orgId, dto);
  }

  /**
   * Update a report subscription
   * RBAC: OWNER, MANAGER
   */
  @Patch('subscriptions/:id')
  @Roles('L4', 'L5')
  async updateSubscription(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<any> {
    return this.subscriptionService.updateSubscription(req.user.orgId, id, dto);
  }

  /**
   * Delete a report subscription
   * RBAC: OWNER, MANAGER
   */
  @Delete('subscriptions/:id')
  @Roles('L4', 'L5')
  async deleteSubscription(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.subscriptionService.deleteSubscription(req.user.orgId, id);
  }
}
