import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../me/user.decorator';
import { AntiTheftService } from './anti-theft.service';

/**
 * M5: Anti-Theft Dashboards API
 *
 * Endpoints for anti-theft analysis and risk detection.
 * RBAC: L4+ (OWNER, MANAGER)
 */
@Controller('anti-theft')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AntiTheftController {
  constructor(private readonly antiTheft: AntiTheftService) {}

  /**
   * Get anti-theft summary with flagged staff
   *
   * @param branchId - Optional: Specific branch
   * @param shiftId - Optional: Specific shift
   * @param from - Optional: Start date (ISO string)
   * @param to - Optional: End date (ISO string)
   *
   * Returns staff with threshold violations sorted by risk score
   */
  @Get('summary')
  @Roles('L4', 'L5')
  async getSummary(
    @User() user: { orgId: string },
    @Query('branchId') branchId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.antiTheft.getAntiTheftSummary(
      user.orgId,
      branchId,
      shiftId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * Note: For raw anomaly events, use GET /dash/anomalies/recent
   * This module focuses on threshold violations and risk scoring.
   */
}
