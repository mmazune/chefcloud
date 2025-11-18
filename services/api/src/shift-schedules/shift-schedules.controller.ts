import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShiftSchedulesService } from './shift-schedules.service';
import { CreateShiftScheduleDto } from './dto/create-shift-schedule.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * M2-SHIFTS: Controller for shift schedules
 * L4/L5 for create/delete, L3+ for view
 */
@Controller('shift-schedules')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShiftSchedulesController {
  constructor(private readonly schedulesService: ShiftSchedulesService) {}

  @Post()
  @Roles('L4', 'L5')
  async create(@Req() req: any, @Body() dto: CreateShiftScheduleDto) {
    return this.schedulesService.create(req.user.orgId, dto);
  }

  @Get('by-branch/:branchId')
  @Roles('L3', 'L4', 'L5')
  async findByBranch(
    @Req() req: any,
    @Param('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Default to current week if dates not provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 format (YYYY-MM-DD)');
    }

    return this.schedulesService.findByBranchAndDateRange(req.user.orgId, branchId, start, end);
  }

  @Get('current/:branchId')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async findCurrent(@Req() req: any, @Param('branchId') branchId: string) {
    return this.schedulesService.findCurrentSchedules(req.user.orgId, branchId);
  }

  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.schedulesService.findOne(req.user.orgId, id);
  }

  @Delete(':id')
  @Roles('L4', 'L5')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.schedulesService.remove(req.user.orgId, id);
  }
}
