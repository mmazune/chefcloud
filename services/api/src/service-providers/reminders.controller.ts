import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RemindersService } from './reminders.service';
import { UpdateReminderDto } from './dto/reminder.dto';
import { ReminderStatus, ReminderSeverity } from '@chefcloud/db';

/**
 * M7: Service Payable Reminders API
 * 
 * RBAC:
 * - L3+ (Procurement, Accountant, Manager, Owner): Can view and update reminders
 */
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance/service-reminders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  @Get()
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'List service payment reminders (L3+)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ReminderStatus })
  @ApiQuery({ name: 'severity', required: false, enum: ReminderSeverity })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getReminders(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: ReminderStatus,
    @Query('severity') severity?: ReminderSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getReminders(
      req.user.orgId,
      branchId,
      status,
      severity,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('summary')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'Get reminder summary statistics (L3+)' })
  @ApiQuery({ name: 'branchId', required: false })
  async getReminderSummary(
    @Request() req: any,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.getReminderSummary(req.user.orgId, branchId);
  }

  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'Get reminder details (L3+)' })
  async getReminder(
    @Request() req: any,
    @Param('id') reminderId: string,
  ) {
    return this.service.getReminder(req.user.orgId, reminderId);
  }

  @Patch(':id')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'Update reminder status (L3+)' })
  async updateReminder(
    @Request() req: any,
    @Param('id') reminderId: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.service.updateReminder(req.user.orgId, reminderId, req.user.id, dto);
  }
}
