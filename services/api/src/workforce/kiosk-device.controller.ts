/**
 * M10.21 + M10.22: Kiosk Device Controller
 *
 * Admin endpoints for kiosk device management (L4+ only).
 * M10.22 additions: Device health, fraud metrics, exports.
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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KioskDeviceService } from './kiosk-device.service';
import { KioskSessionService } from './kiosk-session.service';
import { KioskReportingService } from './kiosk-reporting.service';
import { KioskHealthService } from './kiosk-health.service';
import { KioskFraudService } from './kiosk-fraud.service';
import { KioskOpsReportingService } from './kiosk-ops-reporting.service';

@Controller('workforce/kiosk')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KioskDeviceController {
  constructor(
    private readonly deviceService: KioskDeviceService,
    private readonly sessionService: KioskSessionService,
    private readonly reportingService: KioskReportingService,
    private readonly healthService: KioskHealthService,
    private readonly fraudService: KioskFraudService,
    private readonly opsReportingService: KioskOpsReportingService,
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

  // ===== M10.22: Device Health =====

  /**
   * GET /workforce/kiosk/health
   * Get device health status for all devices.
   * H3: Computed status (ONLINE/STALE/OFFLINE/DISABLED) via DB query, no timers.
   */
  @Get('health')
  @Roles('L4', 'L5')
  async getDevicesHealth(
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    return this.healthService.getDevicesHealth(req.user.orgId, branchId);
  }

  /**
   * GET /workforce/kiosk/health/metrics
   * Get aggregated health metrics by branch.
   */
  @Get('health/metrics')
  @Roles('L4', 'L5')
  async getHealthMetrics(
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    return this.healthService.getHealthMetrics(req.user.orgId, branchId);
  }

  /**
   * GET /workforce/kiosk/devices/:id/health
   * Get health status for a specific device.
   */
  @Get('devices/:id/health')
  @Roles('L4', 'L5')
  async getDeviceHealth(
    @Param('id') deviceId: string,
    @Request() req: any,
  ) {
    return this.healthService.getDeviceHealth(deviceId, req.user.orgId);
  }

  // ===== M10.22: Fraud Metrics =====

  /**
   * GET /workforce/kiosk/fraud
   * Get fraud metrics with anomaly detection.
   * H6: Fair rate limiting per user using DB sliding window.
   */
  @Get('fraud')
  @Roles('L4', 'L5')
  async getFraudMetrics(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.fraudService.getFraudMetrics(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/kiosk/fraud/export
   * Export PIN attempts to CSV with SHA-256 hash.
   * H5: Normalized LF line endings for consistent hash.
   */
  @Get('fraud/export')
  @Roles('L4', 'L5')
  async exportFraudAttempts(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const result = await this.fraudService.exportAttempts(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=kiosk-pin-attempts.csv');
    res.setHeader('X-Content-SHA256', result.sha256);
    res.send(result.csv);
  }

  // ===== M10.22: Event Batch History =====

  /**
   * GET /workforce/kiosk/devices/:id/batch-history
   * Get batch ingest history for a device.
   */
  @Get('devices/:id/batch-history')
  @Roles('L4', 'L5')
  async getBatchHistory(
    @Param('id') deviceId: string,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.opsReportingService.getBatchHistory(
      deviceId,
      req.user.orgId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /**
   * GET /workforce/kiosk/devices/:id/events
   * Get recent events for a device.
   */
  @Get('devices/:id/events')
  @Roles('L4', 'L5')
  async getDeviceEvents(
    @Param('id') deviceId: string,
    @Query('limit') limit: string | undefined,
    @Query('status') status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | undefined,
    @Request() req: any,
  ) {
    return this.opsReportingService.getDeviceEvents(
      deviceId,
      req.user.orgId,
      limit ? parseInt(limit, 10) : undefined,
      status,
    );
  }

  /**
   * GET /workforce/kiosk/export/batch-events
   * Export batch events to CSV with SHA-256 hash.
   * H5: Normalized LF line endings for consistent hash.
   */
  @Get('export/batch-events')
  @Roles('L4', 'L5')
  async exportBatchEvents(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const result = await this.opsReportingService.exportEvents(req.user.orgId, {
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=kiosk-batch-events.csv');
    res.setHeader('X-Content-SHA256', result.sha256);
    res.send(result.csv);
  }
}
