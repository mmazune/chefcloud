import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { CreateShiftAssignmentDto } from './dto/create-shift-assignment.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * M2-SHIFTS: Controller for shift assignments
 * L4/L5 for create/delete, L3+ for view
 */
@Controller('shift-assignments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShiftAssignmentsController {
  constructor(private readonly assignmentsService: ShiftAssignmentsService) {}

  @Post()
  @Roles('L4', 'L5')
  async create(@Req() req: any, @Body() dto: CreateShiftAssignmentDto) {
    return this.assignmentsService.create(req.user.orgId, dto);
  }

  @Get('by-schedule/:scheduleId')
  @Roles('L3', 'L4', 'L5')
  async findBySchedule(@Req() req: any, @Param('scheduleId') scheduleId: string) {
    return this.assignmentsService.findBySchedule(req.user.orgId, scheduleId);
  }

  @Get('by-user/:userId')
  @Roles('L3', 'L4', 'L5')
  async findByUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Default to current week if dates not provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 format (YYYY-MM-DD)');
    }

    return this.assignmentsService.findByUser(req.user.orgId, userId, start, end);
  }

  @Delete(':id')
  @Roles('L4', 'L5')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.assignmentsService.remove(req.user.orgId, id);
  }
}
