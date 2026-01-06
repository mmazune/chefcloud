/**
 * M9.6: Enterprise Controls Controller
 *
 * Endpoints for branch hours, blackouts, capacity rules, and SLA reports.
 * RBAC: L4+ for all endpoints.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SchedulingConstraintsService, OperatingHoursDto, BlackoutDto, CapacityRuleDto } from './scheduling-constraints.service';
import { OpsMonitoringService } from './ops-monitoring.service';

interface AuthRequest {
  user: {
    orgId: string;
    userId: string;
    roleLevel: string;
  };
}

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterpriseControlsController {
  constructor(
    private schedulingConstraints: SchedulingConstraintsService,
    private opsMonitoring: OpsMonitoringService,
  ) { }

  // ===== Operating Hours =====

  @Get('branch-hours')
  @Roles('L4', 'L5')
  async getOperatingHours(@Query('branchId') branchId: string) {
    return this.schedulingConstraints.getOperatingHours(branchId);
  }

  @Put('branch-hours')
  @Roles('L4', 'L5')
  async setOperatingHours(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Body() body: { hours: OperatingHoursDto[] },
  ) {
    return this.schedulingConstraints.setOperatingHours(
      req.user.orgId,
      branchId,
      body.hours,
    );
  }

  @Delete('branch-hours/:dayOfWeek')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOperatingHours(
    @Query('branchId') branchId: string,
    @Param('dayOfWeek') dayOfWeek: string,
  ) {
    await this.schedulingConstraints.deleteOperatingHours(branchId, parseInt(dayOfWeek, 10));
  }

  // ===== Blackouts =====

  @Get('blackouts')
  @Roles('L4', 'L5')
  async getBlackouts(
    @Query('branchId') branchId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;
    return this.schedulingConstraints.getBlackouts(branchId, startDate, endDate);
  }

  @Post('blackouts')
  @Roles('L4', 'L5')
  async createBlackout(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Body() body: { title: string; startAt: string; endAt: string; reason?: string },
  ) {
    return this.schedulingConstraints.createBlackout(
      req.user.orgId,
      branchId,
      {
        title: body.title,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        reason: body.reason,
      },
      req.user.userId,
    );
  }

  @Put('blackouts/:id')
  @Roles('L4', 'L5')
  async updateBlackout(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { title?: string; startAt?: string; endAt?: string; reason?: string },
  ) {
    return this.schedulingConstraints.updateBlackout(req.user.orgId, id, {
      title: body.title,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      reason: body.reason,
    });
  }

  @Delete('blackouts/:id')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlackout(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.schedulingConstraints.deleteBlackout(req.user.orgId, id);
  }

  // ===== Capacity Rules =====

  @Get('capacity-rules')
  @Roles('L4', 'L5')
  async getCapacityRules(@Query('branchId') branchId: string) {
    return this.schedulingConstraints.getCapacityRule(branchId);
  }

  @Put('capacity-rules')
  @Roles('L4', 'L5')
  async setCapacityRules(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Body() body: CapacityRuleDto,
  ) {
    return this.schedulingConstraints.setCapacityRule(req.user.orgId, branchId, body);
  }

  // ===== SLA Reports =====

  @Get('reports/sla')
  @Roles('L4', 'L5')
  async getSlaReport(
    @Query('branchId') branchId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.opsMonitoring.getSlaMetrics(
      branchId,
      new Date(start),
      new Date(end),
    );
  }

  @Get('reports/sla/export')
  @Roles('L4', 'L5')
  async exportSlaReport(
    @Query('branchId') branchId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res() res: Response,
  ) {
    const metrics = await this.opsMonitoring.getSlaMetrics(
      branchId,
      new Date(start),
      new Date(end),
    );
    const csv = this.opsMonitoring.exportSlaMetricsCsv(metrics);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sla-report-${branchId}.csv"`);
    res.send(csv);
  }

  // ===== Ops Incidents =====

  @Get('incidents')
  @Roles('L4', 'L5')
  async getIncidents(
    @Req() req: AuthRequest,
    @Query('branchId') branchId?: string,
    @Query('resolved') resolved?: string,
  ): Promise<object[]> {
    return this.opsMonitoring.getIncidents(
      req.user.orgId,
      branchId,
      resolved === undefined ? undefined : resolved === 'true',
    );
  }

  @Put('incidents/:id/resolve')
  @Roles('L5')
  async resolveIncident(@Req() req: AuthRequest, @Param('id') id: string): Promise<object> {
    return this.opsMonitoring.resolveIncident(req.user.orgId, id, req.user.userId);
  }
}
