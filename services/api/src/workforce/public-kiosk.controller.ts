/**
 * M10.21 + M10.22: Public Kiosk Controller
 *
 * Public endpoints for kiosk timeclock operations.
 * No JWT auth - uses device secret + session token.
 * H7: Branch is derived from enrolled device, never from client.
 *
 * M10.22 additions:
 * - POST /events/batch: Offline queue replay with idempotency (H1)
 * - Enhanced heartbeat with health tracking (H3)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Ip,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { KioskDeviceService } from './kiosk-device.service';
import { KioskSessionService } from './kiosk-session.service';
import { KioskTimeclockService } from './kiosk-timeclock.service';
import { KioskBatchIngestService } from './kiosk-batch-ingest.service';
import { KioskHealthService } from './kiosk-health.service';

@Controller('public/workforce/kiosk')
export class PublicKioskController {
  constructor(
    private readonly deviceService: KioskDeviceService,
    private readonly sessionService: KioskSessionService,
    private readonly timeclockService: KioskTimeclockService,
    private readonly batchIngestService: KioskBatchIngestService,
    private readonly healthService: KioskHealthService,
  ) {}

  // ===== Device Authentication =====

  /**
   * POST /public/workforce/kiosk/:publicId/authenticate
   * Authenticate device and start session.
   * Returns session ID for subsequent requests.
   */
  @Post(':publicId/authenticate')
  async authenticate(
    @Param('publicId') publicId: string,
    @Body() body: { secret: string },
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ipAddress: string,
  ) {
    // Validate device secret
    const result = await this.deviceService.validateDeviceSecret(
      publicId,
      body.secret,
    );

    if (!result) {
      throw new UnauthorizedException('Invalid device credentials');
    }

    // Start session
    const session = await this.sessionService.startSession({
      kioskDeviceId: result.device.id,
      orgId: result.device.orgId,
      ipAddress,
      userAgent,
    });

    return {
      sessionId: session.sessionId,
      device: {
        id: session.device.id,
        name: session.device.name,
        publicId: session.device.publicId,
        branch: session.device.branch,
      },
    };
  }

  /**
   * GET /public/workforce/kiosk/:publicId/info
   * Get public device info (name, branch) for display.
   * No authentication required.
   */
  @Get(':publicId/info')
  async getDeviceInfo(@Param('publicId') publicId: string) {
    const device = await this.deviceService.getDeviceByPublicId(publicId);

    if (!device) {
      throw new UnauthorizedException('Device not found or disabled');
    }

    return {
      name: device.name,
      branch: device.branch,
    };
  }

  // ===== M10.22: Batch Event Ingest =====

  /**
   * POST /public/workforce/kiosk/:publicId/events/batch
   * Process batch of offline-queued events with idempotency.
   * H1: Idempotency via unique (kioskDeviceId, idempotencyKey).
   * H2: Sequence validation for clock state transitions.
   * H8: UI calls this on user action, not timer.
   */
  @Post(':publicId/events/batch')
  async processBatch(
    @Param('publicId') publicId: string,
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: {
      batchId: string;
      events: Array<{
        type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
        idempotencyKey: string;
        occurredAt: string;
        pin: string;
      }>;
    },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    // Validate body
    if (!body.batchId || !body.events || !Array.isArray(body.events)) {
      throw new BadRequestException('batchId and events array required');
    }

    if (body.events.length === 0) {
      throw new BadRequestException('events array cannot be empty');
    }

    if (body.events.length > 100) {
      throw new BadRequestException('Maximum 100 events per batch');
    }

    // Validate session
    const validated = await this.sessionService.validateSession(sessionId);
    if (!validated) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Verify publicId matches session device
    const device = await this.deviceService.getDeviceByPublicId(publicId);
    if (!device || device.id !== validated.device.id) {
      throw new UnauthorizedException('Device mismatch');
    }

    // Process batch
    const result = await this.batchIngestService.processBatch(
      {
        id: device.id,
        orgId: device.orgId,
        branchId: device.branchId,
        name: device.name,
      },
      body.batchId,
      body.events.map(e => ({
        type: e.type,
        idempotencyKey: e.idempotencyKey,
        occurredAt: new Date(e.occurredAt),
        pin: e.pin,
      })),
      ipAddress,
    );

    return result;
  }

  // ===== Session Management =====

  /**
   * POST /public/workforce/kiosk/:publicId/heartbeat
   * Keep session alive and update device health.
   * M10.22: Also updates device lastSeenAt for health tracking (H3).
   */
  @Post(':publicId/heartbeat')
  async heartbeat(
    @Param('publicId') publicId: string,
    @Headers('x-kiosk-session') sessionId: string | undefined,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    // Get device to update its lastSeenAt
    const device = await this.deviceService.getDeviceByPublicId(publicId);
    if (device) {
      // M10.22: Update device health status
      await this.healthService.updateHeartbeat(device.id, sessionId);
    }

    return this.sessionService.heartbeat(sessionId);
  }

  /**
   * POST /public/workforce/kiosk/:publicId/logout
   * End session.
   */
  @Post(':publicId/logout')
  async logout(
    @Param('publicId') publicId: string,
    @Headers('x-kiosk-session') sessionId: string | undefined,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    // Get device for orgId
    const device = await this.deviceService.getDeviceByPublicId(publicId);
    if (!device) {
      throw new UnauthorizedException('Device not found');
    }

    return this.sessionService.endSession(sessionId, device.orgId, 'MANUAL');
  }

  // ===== Timeclock Operations =====

  /**
   * POST /public/workforce/kiosk/:publicId/clock-in
   * Clock in via PIN.
   * H7: branchId is NOT accepted from client - derived from device.
   */
  @Post(':publicId/clock-in')
  async clockIn(
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: { pin: string },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    return this.timeclockService.clockIn(sessionId, body.pin, ipAddress);
  }

  /**
   * POST /public/workforce/kiosk/:publicId/clock-out
   * Clock out via PIN.
   */
  @Post(':publicId/clock-out')
  async clockOut(
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: { pin: string },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    return this.timeclockService.clockOut(sessionId, body.pin, ipAddress);
  }

  /**
   * POST /public/workforce/kiosk/:publicId/break/start
   * Start break via PIN.
   */
  @Post(':publicId/break/start')
  async startBreak(
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: { pin: string },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    return this.timeclockService.startBreak(sessionId, body.pin, ipAddress);
  }

  /**
   * POST /public/workforce/kiosk/:publicId/break/end
   * End break via PIN.
   */
  @Post(':publicId/break/end')
  async endBreak(
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: { pin: string },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    return this.timeclockService.endBreak(sessionId, body.pin, ipAddress);
  }

  /**
   * POST /public/workforce/kiosk/:publicId/status
   * Get clock status for PIN.
   */
  @Post(':publicId/status')
  async getStatus(
    @Headers('x-kiosk-session') sessionId: string | undefined,
    @Body() body: { pin: string },
    @Ip() ipAddress: string,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    return this.timeclockService.getStatus(sessionId, body.pin, ipAddress);
  }
}
