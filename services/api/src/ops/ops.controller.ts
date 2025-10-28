/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OpsService } from './ops.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('ops')
export class OpsController {
  constructor(private opsService: OpsService) {}

  @Get('health')
  async getHealth() {
    return this.opsService.getHealthStatus();
  }

  @Get('metrics')
  async getMetrics() {
    const metricsText = this.opsService.getMetrics();
    return metricsText;
  }

  @Post('diag/snapshot')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async createDiagSnapshot(@Req() req: any) {
    return this.opsService.createDiagSnapshot(req.user.userId);
  }
}
