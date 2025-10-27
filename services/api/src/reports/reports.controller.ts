/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

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
}
