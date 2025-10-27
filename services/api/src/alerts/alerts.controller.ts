import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AlertsService } from './alerts.service';
import { CreateChannelDto, CreateScheduleDto } from './alerts.dto';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('channels')
  @Roles('L4')
  async createChannel(@Req() req: any, @Body() dto: CreateChannelDto) {
    return this.alertsService.createChannel(req.user.orgId, dto);
  }

  @Post('schedules')
  @Roles('L4')
  async createSchedule(@Req() req: any, @Body() dto: CreateScheduleDto) {
    return this.alertsService.createSchedule(req.user.orgId, dto);
  }

  @Post('run-now/:id')
  @Roles('L4')
  async runNow(@Req() req: any, @Param('id') id: string) {
    return this.alertsService.runScheduleNow(id, req.user.orgId);
  }
}
