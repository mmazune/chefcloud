/**
 * M10.21: Kiosk Timeclock Service
 *
 * Handles PIN authentication, clock-in/out, and break operations for kiosk mode.
 * Implements H1 (org-scoped PIN lookup), H3 (DB-based rate limiting), H7 (branch from device).
 */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from '../auth/auth.helpers';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';
import { KioskSessionService } from './kiosk-session.service';
import { WorkforceTimeclockService } from './workforce-timeclock.service';
import { GeoFenceService, GEOFENCE_EVENT_TYPES } from './geofence.service';

// Clock event types
export const KIOSK_CLOCK_EVENTS = {
  CLOCK_IN: 'CLOCK_IN',
  CLOCK_OUT: 'CLOCK_OUT',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
} as const;

export type KioskClockEventType = typeof KIOSK_CLOCK_EVENTS[keyof typeof KIOSK_CLOCK_EVENTS];

// PIN validation regex (4-6 digits)
const PIN_REGEX = /^\d{4,6}$/;

@Injectable()
export class KioskTimeclockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
    private readonly sessionService: KioskSessionService,
    private readonly timeclockService: WorkforceTimeclockService,
    private readonly geoFenceService: GeoFenceService,
  ) { }

  /**
   * Validate PIN format.
   */
  private validatePinFormat(pin: string): void {
    if (!PIN_REGEX.test(pin)) {
      throw new BadRequestException('PIN must be 4-6 digits');
    }
  }

  /**
   * Mask PIN for storage (security: only store last 2 chars).
   */
  private maskPin(pin: string): string {
    const masked = '*'.repeat(pin.length - 2);
    return masked + pin.slice(-2);
  }

  /**
   * H3: Check PIN rate limit (DB-based sliding window, NO timers).
   */
  async checkPinRateLimit(kioskDeviceId: string, orgId: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - 60_000); // 1 minute sliding window

    const recentAttempts = await this.prisma.client.kioskPinAttempt.count({
      where: {
        kioskDeviceId,
        attemptedAt: { gte: windowStart },
      },
    });

    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });
    const limit = policy?.kioskPinRateLimitPerMinute ?? 5;

    return recentAttempts < limit;
  }

  /**
   * Record PIN attempt (for rate limiting and audit).
   */
  private async recordPinAttempt(data: {
    orgId: string;
    branchId: string;
    kioskDeviceId: string;
    pin: string;
    success: boolean;
    userId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.client.kioskPinAttempt.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        kioskDeviceId: data.kioskDeviceId,
        pinMasked: this.maskPin(data.pin),
        success: data.success,
        userId: data.userId,
        ipAddress: data.ipAddress,
      },
    });
  }

  /**
   * H1: Org-scoped PIN lookup.
   * Looks up user by PIN within the organization only.
   */
  async lookupUserByPin(
    orgId: string,
    pin: string,
  ): Promise<{ user: any } | null> {
    this.validatePinFormat(pin);

    // H1: Query ONLY users in this org with PIN set
    const users = await this.prisma.client.user.findMany({
      where: {
        orgId,
        pinHash: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pinHash: true,
        branchId: true,
        roleLevel: true,
      },
    });

    // Verify PIN against each candidate
    for (const user of users) {
      if (user.pinHash && await AuthHelpers.verifyPin(user.pinHash, pin)) {
        return { user };
      }
    }

    return null;
  }

  /**
   * Validate session and extract device info.
   * H7: Branch is derived from device, never from client.
   */
  private async validateSessionAndGetDevice(sessionId: string): Promise<{
    session: any;
    device: any;
    orgId: string;
    branchId: string;
  }> {
    const validated = await this.sessionService.validateSession(sessionId);

    if (!validated) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    return {
      session: validated.session,
      device: validated.device,
      orgId: validated.device.orgId,
      branchId: validated.device.branchId, // H7: Always from device
    };
  }

  /**
   * Log kiosk clock event.
   */
  private async logClockEvent(data: {
    orgId: string;
    branchId: string;
    kioskDeviceId: string;
    userId: string;
    eventType: KioskClockEventType;
    timeEntryId?: string;
    breakEntryId?: string;
    geoBlocked?: boolean;
    geoOverridden?: boolean;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.client.kioskClockEvent.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        kioskDeviceId: data.kioskDeviceId,
        userId: data.userId,
        eventType: data.eventType,
        timeEntryId: data.timeEntryId,
        breakEntryId: data.breakEntryId,
        geoBlocked: data.geoBlocked ?? false,
        geoOverridden: data.geoOverridden ?? false,
        ipAddress: data.ipAddress,
      },
    });
  }

  /**
   * Clock in via kiosk PIN.
   */
  async clockIn(
    sessionId: string,
    pin: string,
    ipAddress?: string,
  ): Promise<any> {
    const { device, orgId, branchId } = await this.validateSessionAndGetDevice(sessionId);

    // H3: Check rate limit
    const allowed = await this.checkPinRateLimit(device.id, orgId);
    if (!allowed) {
      await this.auditService.logAction({
        orgId,
        performedById: device.id,
        action: WorkforceAuditAction.KIOSK_PIN_RATE_LIMITED,
        entityType: 'KioskDevice',
        entityId: device.id,
        payload: { pin: this.maskPin(pin), ipAddress },
      });
      throw new ForbiddenException('Too many PIN attempts. Please wait before trying again.');
    }

    // H1: Org-scoped PIN lookup
    const lookup = await this.lookupUserByPin(orgId, pin);

    // Record attempt (success or failure)
    await this.recordPinAttempt({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      pin,
      success: !!lookup,
      userId: lookup?.user.id,
      ipAddress,
    });

    if (!lookup) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const { user } = lookup;

    // Check geofence enforcement for kiosk (H5)
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });

    if (policy?.requireGeofenceForKiosk) {
      // For kiosk, we use branch geofence center (device is fixed at branch)
      const geofence = await this.prisma.client.branchGeoFence.findUnique({
        where: { branchId },
      });

      if (geofence && geofence.enabled && geofence.enforceClockIn) {
        // Log as allowed (kiosk is pre-enrolled at branch location)
        await this.geoFenceService.logEvent(
          orgId,
          branchId,
          user.id,
          GEOFENCE_EVENT_TYPES.ALLOWED,
          'CLOCK_IN',
          {
            lat: Number(geofence.centerLat),
            lng: Number(geofence.centerLng),
            radiusMeters: geofence.radiusMeters,
          },
        );
      }
    }

    // Delegate to WorkforceTimeclockService
    const entry = await this.timeclockService.clockIn({
      userId: user.id,
      orgId,
      branchId, // H7: From device
      method: 'PASSWORD', // PIN is a form of password auth
      kioskDeviceId: device.id,
    });

    // Log kiosk event
    await this.logClockEvent({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      userId: user.id,
      eventType: KIOSK_CLOCK_EVENTS.CLOCK_IN,
      timeEntryId: entry.id,
      ipAddress,
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: user.id,
      action: WorkforceAuditAction.KIOSK_CLOCK_IN,
      entityType: 'TimeEntry',
      entityId: entry.id,
      payload: {
        kioskDeviceId: device.id,
        branchId,
        userName: `${user.firstName} ${user.lastName}`,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      timeEntry: entry,
    };
  }

  /**
   * Clock out via kiosk PIN.
   */
  async clockOut(
    sessionId: string,
    pin: string,
    ipAddress?: string,
  ): Promise<any> {
    const { device, orgId, branchId } = await this.validateSessionAndGetDevice(sessionId);

    // H3: Check rate limit
    const allowed = await this.checkPinRateLimit(device.id, orgId);
    if (!allowed) {
      throw new ForbiddenException('Too many PIN attempts. Please wait before trying again.');
    }

    // H1: Org-scoped PIN lookup
    const lookup = await this.lookupUserByPin(orgId, pin);

    await this.recordPinAttempt({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      pin,
      success: !!lookup,
      userId: lookup?.user.id,
      ipAddress,
    });

    if (!lookup) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const { user } = lookup;

    // Delegate to WorkforceTimeclockService
    const entry = await this.timeclockService.clockOut(user.id, orgId);

    // Log kiosk event
    await this.logClockEvent({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      userId: user.id,
      eventType: KIOSK_CLOCK_EVENTS.CLOCK_OUT,
      timeEntryId: entry.id,
      ipAddress,
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: user.id,
      action: WorkforceAuditAction.KIOSK_CLOCK_OUT,
      entityType: 'TimeEntry',
      entityId: entry.id,
      payload: {
        kioskDeviceId: device.id,
        branchId,
        userName: `${user.firstName} ${user.lastName}`,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      timeEntry: entry,
    };
  }

  /**
   * Start break via kiosk PIN.
   */
  async startBreak(
    sessionId: string,
    pin: string,
    ipAddress?: string,
  ): Promise<any> {
    const { device, orgId, branchId } = await this.validateSessionAndGetDevice(sessionId);

    // H3: Check rate limit
    const allowed = await this.checkPinRateLimit(device.id, orgId);
    if (!allowed) {
      throw new ForbiddenException('Too many PIN attempts. Please wait before trying again.');
    }

    // H1: Org-scoped PIN lookup
    const lookup = await this.lookupUserByPin(orgId, pin);

    await this.recordPinAttempt({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      pin,
      success: !!lookup,
      userId: lookup?.user.id,
      ipAddress,
    });

    if (!lookup) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const { user } = lookup;

    // Delegate to WorkforceTimeclockService
    const breakEntry = await this.timeclockService.startBreak(user.id, orgId);

    // Log kiosk event
    await this.logClockEvent({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      userId: user.id,
      eventType: KIOSK_CLOCK_EVENTS.BREAK_START,
      breakEntryId: breakEntry.id,
      ipAddress,
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: user.id,
      action: WorkforceAuditAction.KIOSK_BREAK_START,
      entityType: 'BREAK',
      entityId: breakEntry.id,
      payload: {
        kioskDeviceId: device.id,
        branchId,
        userName: `${user.firstName} ${user.lastName}`,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      breakEntry,
    };
  }

  /**
   * End break via kiosk PIN.
   */
  async endBreak(
    sessionId: string,
    pin: string,
    ipAddress?: string,
  ): Promise<any> {
    const { device, orgId, branchId } = await this.validateSessionAndGetDevice(sessionId);

    // H3: Check rate limit
    const allowed = await this.checkPinRateLimit(device.id, orgId);
    if (!allowed) {
      throw new ForbiddenException('Too many PIN attempts. Please wait before trying again.');
    }

    // H1: Org-scoped PIN lookup
    const lookup = await this.lookupUserByPin(orgId, pin);

    await this.recordPinAttempt({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      pin,
      success: !!lookup,
      userId: lookup?.user.id,
      ipAddress,
    });

    if (!lookup) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const { user } = lookup;

    // Find active break for user
    const activeEntry = await this.prisma.client.timeEntry.findFirst({
      where: { userId: user.id, orgId, clockOutAt: null },
      include: { breakEntries: true },
    });

    if (!activeEntry) {
      throw new BadRequestException('No active clock-in found');
    }

    const activeBreak = activeEntry.breakEntries.find(b => !b.endedAt);
    if (!activeBreak) {
      throw new BadRequestException('No active break to end');
    }

    // End the break
    const breakEntry = await this.timeclockService.endBreak(activeBreak.id);

    // Log kiosk event
    await this.logClockEvent({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      userId: user.id,
      eventType: KIOSK_CLOCK_EVENTS.BREAK_END,
      breakEntryId: breakEntry.id,
      ipAddress,
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: user.id,
      action: WorkforceAuditAction.KIOSK_BREAK_END,
      entityType: 'BREAK',
      entityId: breakEntry.id,
      payload: {
        kioskDeviceId: device.id,
        branchId,
        userName: `${user.firstName} ${user.lastName}`,
        minutes: breakEntry.minutes,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      breakEntry,
    };
  }

  /**
   * Get clock status for PIN (quick lookup without performing action).
   */
  async getStatus(
    sessionId: string,
    pin: string,
    ipAddress?: string,
  ): Promise<any> {
    const { device, orgId, branchId } = await this.validateSessionAndGetDevice(sessionId);

    // H3: Check rate limit (status checks also count)
    const allowed = await this.checkPinRateLimit(device.id, orgId);
    if (!allowed) {
      throw new ForbiddenException('Too many PIN attempts. Please wait before trying again.');
    }

    // H1: Org-scoped PIN lookup
    const lookup = await this.lookupUserByPin(orgId, pin);

    await this.recordPinAttempt({
      orgId,
      branchId,
      kioskDeviceId: device.id,
      pin,
      success: !!lookup,
      userId: lookup?.user.id,
      ipAddress,
    });

    if (!lookup) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const { user } = lookup;

    // Get current status from timeclock service
    const status = await this.timeclockService.getClockStatus(user.id, orgId);

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      status,
    };
  }
}
