import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService } from './billing.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';
import { DemoProtectionService } from '../common/demo/demo-protection.service'; // M33-DEMO-S4
import { PrismaService } from '../prisma.service'; // M33-DEMO-S4

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
  constructor(
    private billingService: BillingService,
    private demoProtection: DemoProtectionService, // M33-DEMO-S4
    private prisma: PrismaService, // M33-DEMO-S4
  ) {}

  @Get('subscription')
  @Roles('L5')
  async getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(req.user.orgId);
  }

  /**
   * Change subscription plan
   * Protected by plan-aware rate limiting
   * M33-DEMO-S4: Blocked for demo orgs
   */
  @Post('plan/change')
  @Roles('L5')
  @UseGuards(PlanRateLimiterGuard)
  async changePlan(@Req() req: any, @Body() body: { planCode: string }) {
    // M33-DEMO-S4: Block plan changes for demo orgs
    const org = await this.prisma.client.org.findUnique({ where: { id: req.user.orgId } });
    if (this.demoProtection.isDemoWriteProtectedOrg(org)) {
      throw new ForbiddenException({
        code: this.demoProtection.getDemoProtectionErrorCode(),
        message: this.demoProtection.getDemoProtectionErrorMessage('Plan changes are'),
      });
    }

    return this.billingService.requestPlanChange(req.user.orgId, body.planCode);
  }

  /**
   * Cancel subscription
   * Protected by plan-aware rate limiting
   * M33-DEMO-S4: Blocked for demo orgs
   */
  @Post('cancel')
  @Roles('L5')
  @UseGuards(PlanRateLimiterGuard)
  async cancel(@Req() req: any) {
    // M33-DEMO-S4: Block cancellations for demo orgs
    const org = await this.prisma.client.org.findUnique({ where: { id: req.user.orgId } });
    if (this.demoProtection.isDemoWriteProtectedOrg(org)) {
      throw new ForbiddenException({
        code: this.demoProtection.getDemoProtectionErrorCode(),
        message: this.demoProtection.getDemoProtectionErrorMessage('Subscription cancellation is'),
      });
    }

    return this.billingService.requestCancellation(req.user.orgId);
  }
}
