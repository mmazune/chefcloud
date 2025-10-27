/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto, CloseShiftDto } from './shifts.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('shifts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Post('open')
  @Roles('L3')
  async openShift(@Req() req: any, @Body() dto: OpenShiftDto): Promise<any> {
    const { orgId, branchId, userId } = req.user;
    return this.shiftsService.openShift(orgId, branchId, userId, dto);
  }

  @Patch(':id/close')
  @Roles('L3')
  async closeShift(
    @Req() req: any,
    @Param('id') shiftId: string,
    @Body() dto: CloseShiftDto,
  ): Promise<any> {
    return this.shiftsService.closeShift(shiftId, req.user.userId, dto);
  }

  @Get('current')
  @Roles('L1')
  async getCurrentShift(@Req() req: any): Promise<any> {
    return this.shiftsService.getCurrentShift(req.user.branchId);
  }

  @Get('history')
  @Roles('L3')
  async getShiftHistory(@Req() req: any): Promise<any> {
    return this.shiftsService.getShiftHistory(req.user.branchId);
  }
}
