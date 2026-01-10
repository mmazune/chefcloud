import { Controller, Post, Patch, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PeriodsService } from './periods.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../me/user.decorator';
import { RequireCapability } from '../auth/require-capability.decorator';
import { HighRiskCapability } from '../auth/capabilities';
import { CapabilitiesGuard } from '../auth/capabilities.guard';

@Controller('accounting/periods')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  @Roles('L5')
  async createPeriod(@User() user: any, @Body() body: { name: string; startsAt: string; endsAt: string }) {
    return { success: true, period: await this.periodsService.createPeriod(user.orgId, body.name, new Date(body.startsAt), new Date(body.endsAt)) };
  }

  @Patch(':id/close')
  @Roles('L5')
  async closePeriod(@User() user: any, @Param('id') periodId: string) {
    return { success: true, period: await this.periodsService.closePeriod(periodId, user.id) };
  }

  @Patch(':id/lock')
  @Roles('L5')
  async lockPeriod(@User() user: any, @Param('id') periodId: string) {
    return { success: true, period: await this.periodsService.lockPeriod(periodId, user.id) };
  }

  /**
   * Reopen a closed fiscal period (L5/OWNER only)
   * HIGH RISK: Requires FINANCE_PERIOD_REOPEN capability
   */
  @Patch(':id/reopen')
  @Roles('L5')
  @UseGuards(CapabilitiesGuard)
  @RequireCapability(HighRiskCapability.FINANCE_PERIOD_REOPEN)
  async reopenPeriod(@User() user: any, @Param('id') periodId: string) {
    return { success: true, period: await this.periodsService.reopenPeriod(periodId, user.id) };
  }

  @Get()
  @Roles('L4', 'L5')
  async listPeriods(@User() user: any, @Query('status') status?: 'OPEN' | 'CLOSED' | 'LOCKED') {
    return { success: true, periods: await this.periodsService.listPeriods(user.orgId, status) };
  }

  @Get(':id')
  @Roles('L4', 'L5')
  async getPeriod(@Param('id') periodId: string) {
    return { success: true, period: await this.periodsService.getPeriod(periodId) };
  }
}
