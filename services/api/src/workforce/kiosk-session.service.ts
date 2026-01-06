/**
 * M10.21: Kiosk Device Session Service
 *
 * Handles session lifecycle with heartbeat tracking.
 * H8: No timers/intervals - uses DB-based timeout checks.
 */

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

// Session end reasons
export const SESSION_END_REASONS = {
  EXPIRED: 'EXPIRED',
  ROTATED: 'ROTATED',
  MANUAL: 'MANUAL',
  HEARTBEAT_TIMEOUT: 'HEARTBEAT_TIMEOUT',
} as const;

export type SessionEndReason = typeof SESSION_END_REASONS[keyof typeof SESSION_END_REASONS];

@Injectable()
export class KioskSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * Get session timeout from org policy.
   */
  private async getSessionTimeoutMinutes(orgId: string): Promise<number> {
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });
    return policy?.kioskSessionTimeoutMinutes ?? 720; // 12 hours default
  }

  /**
   * Start a new session for an authenticated device.
   */
  async startSession(data: {
    kioskDeviceId: string;
    orgId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; device: any }> {
    // Get device with branch info
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { id: data.kioskDeviceId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!device || !device.enabled) {
      throw new UnauthorizedException('Device not found or disabled');
    }

    // End any existing active sessions for this device (single active session)
    await this.prisma.client.kioskDeviceSession.updateMany({
      where: { kioskDeviceId: data.kioskDeviceId, endedAt: null },
      data: { endedAt: new Date(), endedReason: SESSION_END_REASONS.EXPIRED },
    });

    // Create new session
    const session = await this.prisma.client.kioskDeviceSession.create({
      data: {
        kioskDeviceId: data.kioskDeviceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {},
      },
    });

    // Update device lastSeenAt
    await this.prisma.client.kioskDevice.update({
      where: { id: data.kioskDeviceId },
      data: { lastSeenAt: new Date() },
    });

    // Audit log
    await this.auditService.logAction({
      orgId: data.orgId,
      performedById: data.kioskDeviceId, // Device is the actor
      action: WorkforceAuditAction.KIOSK_SESSION_STARTED,
      entityType: 'KioskDeviceSession',
      entityId: session.id,
      payload: {
        kioskDeviceId: data.kioskDeviceId,
        branchId: device.branchId,
        ipAddress: data.ipAddress,
      },
    });

    return {
      sessionId: session.id,
      device,
    };
  }

  /**
   * Validate a session is active and not expired.
   * H8: No timers - checks timeout against policy at validation time.
   */
  async validateSession(sessionId: string): Promise<{
    session: any;
    device: any;
  } | null> {
    const session = await this.prisma.client.kioskDeviceSession.findUnique({
      where: { id: sessionId },
      include: {
        kioskDevice: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Already ended
    if (session.endedAt) {
      return null;
    }

    // Device disabled
    if (!session.kioskDevice.enabled) {
      await this.endSession(sessionId, session.kioskDevice.orgId, SESSION_END_REASONS.MANUAL);
      return null;
    }

    // Check timeout
    const timeoutMinutes = await this.getSessionTimeoutMinutes(session.kioskDevice.orgId);
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const lastActivity = session.lastHeartbeatAt.getTime();
    const now = Date.now();

    if (now - lastActivity > timeoutMs) {
      await this.endSession(sessionId, session.kioskDevice.orgId, SESSION_END_REASONS.HEARTBEAT_TIMEOUT);
      return null;
    }

    return {
      session,
      device: session.kioskDevice,
    };
  }

  /**
   * Update session heartbeat.
   */
  async heartbeat(sessionId: string): Promise<{ success: boolean }> {
    const session = await this.prisma.client.kioskDeviceSession.findUnique({
      where: { id: sessionId },
      include: {
        kioskDevice: true,
      },
    });

    if (!session || session.endedAt) {
      throw new UnauthorizedException('Session not found or expired');
    }

    if (!session.kioskDevice.enabled) {
      throw new UnauthorizedException('Device disabled');
    }

    await this.prisma.client.kioskDeviceSession.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: new Date() },
    });

    // Update device lastSeenAt
    await this.prisma.client.kioskDevice.update({
      where: { id: session.kioskDeviceId },
      data: { lastSeenAt: new Date() },
    });

    return { success: true };
  }

  /**
   * End a session.
   */
  async endSession(
    sessionId: string,
    orgId: string,
    reason: SessionEndReason,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.client.kioskDeviceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.endedAt) {
      return { success: true }; // Already ended
    }

    await this.prisma.client.kioskDeviceSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), endedReason: reason },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: session.kioskDeviceId,
      action: WorkforceAuditAction.KIOSK_SESSION_ENDED,
      entityType: 'KioskDeviceSession',
      entityId: sessionId,
      payload: { reason },
    });

    return { success: true };
  }

  /**
   * Get active session for device (if any).
   */
  async getActiveSession(kioskDeviceId: string): Promise<any | null> {
    const session = await this.prisma.client.kioskDeviceSession.findFirst({
      where: { kioskDeviceId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    // Validate session is still active
    const validated = await this.validateSession(session.id);
    return validated?.session ?? null;
  }

  /**
   * Get session history for device.
   */
  async getSessionHistory(
    kioskDeviceId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ sessions: any[]; total: number }> {
    const [sessions, total] = await Promise.all([
      this.prisma.client.kioskDeviceSession.findMany({
        where: { kioskDeviceId },
        orderBy: { startedAt: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.client.kioskDeviceSession.count({
        where: { kioskDeviceId },
      }),
    ]);

    return { sessions, total };
  }
}
