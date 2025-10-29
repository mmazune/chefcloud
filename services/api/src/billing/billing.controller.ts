import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BillingService } from './billing.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('billing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('subscription')
  @Roles('L5')
  async getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(req.user.orgId);
  }

  @Post('plan/change')
  @Roles('L5')
  async changePlan(@Req() req: any, @Body() body: { planCode: string }) {
    return this.billingService.requestPlanChange(req.user.orgId, body.planCode);
  }

  @Post('cancel')
  @Roles('L5')
  async cancel(@Req() req: any) {
    return this.billingService.requestCancellation(req.user.orgId);
  }
}
