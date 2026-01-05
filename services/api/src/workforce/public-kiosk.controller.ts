/**
 * M10.21: Public Kiosk Controller
 *
 * Public endpoints for kiosk timeclock operations.
 * No JWT auth - uses device secret + session token.
 * H7: Branch is derived from enrolled device, never from client.
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
} from '@nestjs/common';
import { KioskDeviceService } from './kiosk-device.service';
import { KioskSessionService } from './kiosk-session.service';
import { KioskTimeclockService } from './kiosk-timeclock.service';

@Controller('public/workforce/kiosk')
export class PublicKioskController {
  constructor(
    private readonly deviceService: KioskDeviceService,
    private readonly sessionService: KioskSessionService,
    private readonly timeclockService: KioskTimeclockService,
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

  // ===== Session Management =====

  /**
   * POST /public/workforce/kiosk/:publicId/heartbeat
   * Keep session alive.
   */
  @Post(':publicId/heartbeat')
  async heartbeat(
    @Headers('x-kiosk-session') sessionId: string | undefined,
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
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
