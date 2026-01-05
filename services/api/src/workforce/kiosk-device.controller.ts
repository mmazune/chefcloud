/**
 * M10.21: Kiosk Device Controller
 *
 * Admin endpoints for kiosk device management (L4+ only).
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KioskDeviceService } from './kiosk-device.service';
import { KioskSessionService } from './kiosk-session.service';
import { KioskReportingService } from './kiosk-reporting.service';

@Controller('workforce/kiosk')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KioskDeviceController {
  constructor(
    private readonly deviceService: KioskDeviceService,
    private readonly sessionService: KioskSessionService,
    private readonly reportingService: KioskReportingService,
  ) {}

  // ===== Device CRUD =====

  /**
   * POST /workforce/kiosk/devices
   * Create a new kiosk device. Returns one-time plaintext secret.
   */
  @Post('devices')
  @Roles('L4', 'L5')
  async createDevice(
    @Body() body: {
      branchId: string;
      name: string;
      allowedIpCidrs?: string[];
    },
    @Request() req: any,
  ) {
    const result = await this.deviceService.createDevice({
      orgId: req.user.orgId,
      branchId: body.branchId,
      name: body.name,
      createdById: req.user.id,
      allowedIpCidrs: body.allowedIpCidrs,
    });

    return {
      ...result.device,
      secret: result.plaintextSecret, // One-time only!
      secretNote: 'Save this secret immediately. It will not be shown again.',
    };
  }

  /**
   * GET /workforce/kiosk/devices
   * List kiosk devices for org.
   */
  @Get('devices')
  @Roles('L4', 'L5')
  async listDevices(
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    return this.deviceService.listDevices(req.user.orgId, branchId);
  }

  /**
   * GET /workforce/kiosk/devices/:id
   * Get device details.
   */
  @Get('devices/:id')
  @Roles('L4', 'L5')
  async getDevice(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.deviceService.getDevice(id, req.user.orgId);
  }

  /**
   * PATCH /workforce/kiosk/devices/:id
   * Update device (name, enabled, allowedIpCidrs).
   */
  @Patch('devices/:id')
  @Roles('L4', 'L5')
  async updateDevice(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      enabled?: boolean;
      allowedIpCidrs?: string[];
    },
    @Request() req: any,
  ) {
    return this.deviceService.updateDevice(
      id,
      req.user.orgId,
      req.user.id,
      body,
    );
  }

  /**
   * DELETE /workforce/kiosk/devices/:id
   * Delete device.
   */
  @Delete('devices/:id')
  @Roles('L4', 'L5')
  async deleteDevice(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.deviceService.deleteDevice(id, req.user.orgId, req.user.id);
  }

  /**
   * POST /workforce/kiosk/devices/:id/rotate-secret
   * Rotate device secret. Returns new one-time plaintext secret.
   */
  @Post('devices/:id/rotate-secret')
  @Roles('L4', 'L5')
  async rotateSecret(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const result = await this.deviceService.rotateSecret(
      id,
      req.user.orgId,
      req.user.id,
    );

    return {
      ...result.device,
      secret: result.plaintextSecret,
      secretNote: 'Save this secret immediately. It will not be shown again.',
    };
  }

  // ===== Session Management =====

  /**
   * GET /workforce/kiosk/devices/:id/sessions
   * Get session history for device.
   */
  @Get('devices/:id/sessions')
  @Roles('L4', 'L5')
  async getDeviceSessions(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Request() req: any,
  ): Promise<{ sessions: any[]; total: number }> {
    // Verify device belongs to org
    await this.deviceService.getDevice(id, req.user.orgId);

    return this.sessionService.getSessionHistory(id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ===== Reporting =====

  /**
   * GET /workforce/kiosk/kpis
   * Get kiosk usage KPIs.
   */
  @Get('kpis')
  @Roles('L4', 'L5')
  async getKpis(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getKpis(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/kiosk/device-activity
   * Get device activity report.
   */
  @Get('device-activity')
  @Roles('L4', 'L5')
  async getDeviceActivity(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getDeviceActivity(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/kiosk/top-users
   * Get top users by kiosk usage.
   */
  @Get('top-users')
  @Roles('L4', 'L5')
  async getTopUsers(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getTopUsers(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /workforce/kiosk/export/events
   * Export kiosk clock events to CSV.
   */
  @Get('export/events')
  @Roles('L4', 'L5')
  async exportEvents(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.exportClockEvents(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
