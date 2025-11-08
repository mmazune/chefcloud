import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService } from './billing.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';

/**
 * Billing Controller
 * 
 * Handles subscription and plan management operations.
 * All mutation endpoints are protected by plan-aware rate limiting.
 * 
 * Rate Limits (per user per minute):
 * - Free: 10 requests
 * - Pro: 60 requests
 * - Enterprise: 240 requests
 * - Per-IP: 120 requests (abuse prevention)
 */
@Controller('billing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('subscription')
  @Roles('L5')
  async getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(req.user.orgId);
  }

  /**
   * Change subscription plan
   * Protected by plan-aware rate limiting
   */
  @Post('plan/change')
  @Roles('L5')
  @UseGuards(PlanRateLimiterGuard)
  async changePlan(@Req() req: any, @Body() body: { planCode: string }) {
    return this.billingService.requestPlanChange(req.user.orgId, body.planCode);
  }

  /**
   * Cancel subscription
   * Protected by plan-aware rate limiting
   */
  @Post('cancel')
  @Roles('L5')
  @UseGuards(PlanRateLimiterGuard)
  async cancel(@Req() req: any) {
    return this.billingService.requestCancellation(req.user.orgId);
  }
}
