import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ThresholdsService } from './thresholds.service';
import { User } from '../me/user.decorator';

class UpdateThresholdsDto {
  lateVoidMin?: number;
  heavyDiscountUGX?: number;
  noDrinksWarnRate?: number;
}

@Controller('thresholds')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ThresholdsController {
  constructor(private readonly thresholdsService: ThresholdsService) {}

  /**
   * Get anomaly thresholds for organization
   */
  @Get()
  @Roles('L4', 'L5')
  async getThresholds(@User() user: { orgId: string; userId: string }) {
    return this.thresholdsService.getThresholds(user.orgId);
  }

  /**
   * Update anomaly thresholds
   */
  @Patch()
  @Roles('L4', 'L5')
  async updateThresholds(
    @User() user: { orgId: string; userId: string },
    @Body() dto: UpdateThresholdsDto,
  ) {
    return this.thresholdsService.updateThresholds(user.orgId, user.userId, dto);
  }
}
