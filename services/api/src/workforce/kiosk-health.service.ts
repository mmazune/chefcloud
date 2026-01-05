/**
 * M10.22: Kiosk Health Service
 *
 * Device health monitoring with:
 * - Computed status (ONLINE/STALE/OFFLINE/DISABLED) - no timers (H3)
 * - Session heartbeat management
 * - Health reporting
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

export enum DeviceHealthStatus {
  ONLINE = 'ONLINE',
  STALE = 'STALE',
  OFFLINE = 'OFFLINE',
  DISABLED = 'DISABLED',
}

export interface DeviceHealthInfo {
  id: string;
  name: string;
  publicId: string;
  branchId: string;
  branchName: string;
  enabled: boolean;
  status: DeviceHealthStatus;
  lastSeenAt: Date | null;
  lastHeartbeatAt: Date | null;
  activeSessionId: string | null;
  sessionCount: number;
  eventCount: number;
}

export interface HealthMetrics {
  totalDevices: number;
  onlineCount: number;
  staleCount: number;
  offlineCount: number;
  disabledCount: number;
  byBranch: Record<string, {
    online: number;
    stale: number;
    offline: number;
    disabled: number;
  }>;
}

@Injectable()
export class KioskHealthService {
  private readonly logger = new Logger(KioskHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) {}

  /**
   * Update heartbeat for device and active session.
   * Creates session if none active.
   */
  async updateHeartbeat(
    kioskDeviceId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ deviceId: string; sessionId: string; lastHeartbeatAt: Date }> {
    const now = new Date();

    // Update device lastSeenAt
    await this.prisma.client.kioskDevice.update({
      where: { id: kioskDeviceId },
      data: { lastSeenAt: now },
    });

    // Update session heartbeat
    const session = await this.prisma.client.kioskDeviceSession.findFirst({
      where: {
        id: sessionId,
        kioskDeviceId,
        endedAt: null,
      },
    });

    if (session) {
      await this.prisma.client.kioskDeviceSession.update({
        where: { id: session.id },
        data: {
          lastHeartbeatAt: now,
          ipAddress: ipAddress || session.ipAddress,
          userAgent: userAgent || session.userAgent,
        },
      });
    }

    // Get device for audit
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { id: kioskDeviceId },
    });

    if (device) {
      // Audit heartbeat (H7)
      await this.auditService.logAction({
        orgId: device.orgId,
        performedById: 'SYSTEM_KIOSK',
        action: WorkforceAuditAction.KIOSK_HEARTBEAT,
        entityType: 'KioskDevice',
        entityId: kioskDeviceId,
        payload: {
          description: 'Device heartbeat',
          kioskDeviceId,
          branchId: device.branchId,
          sessionId,
          ipAddress,
        },
      });
    }

    return {
      deviceId: kioskDeviceId,
      sessionId,
      lastHeartbeatAt: now,
    };
  }

  /**
   * Compute device health status based on last heartbeat.
   * No timers - computed at query time (H3).
   */
  computeStatus(
    enabled: boolean,
    lastHeartbeatAt: Date | null,
    staleSeconds: number,
    offlineSeconds: number,
  ): DeviceHealthStatus {
    if (!enabled) {
      return DeviceHealthStatus.DISABLED;
    }

    if (!lastHeartbeatAt) {
      return DeviceHealthStatus.OFFLINE;
    }

    const now = new Date();
    const diffSeconds = (now.getTime() - lastHeartbeatAt.getTime()) / 1000;

    if (diffSeconds <= staleSeconds) {
      return DeviceHealthStatus.ONLINE;
    } else if (diffSeconds <= offlineSeconds) {
      return DeviceHealthStatus.STALE;
    } else {
      return DeviceHealthStatus.OFFLINE;
    }
  }

  /**
   * Get health status for all devices in org/branch.
   */
  async getDevicesHealth(
    orgId: string,
    branchId?: string,
  ): Promise<DeviceHealthInfo[]> {
    // Get policy for thresholds
    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId },
    });

    const staleSeconds = policy?.kioskHeartbeatStaleSeconds ?? 120;
    const offlineSeconds = policy?.kioskHeartbeatOfflineSeconds ?? 900;

    // Get devices with active sessions
    const devices = await this.prisma.client.kioskDevice.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        sessions: {
          where: { endedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            sessions: true,
            clockEvents: true,
          },
        },
      },
    });

    return devices.map(device => {
      const activeSession = device.sessions[0];
      const lastHeartbeatAt = activeSession?.lastHeartbeatAt || null;

      return {
        id: device.id,
        name: device.name,
        publicId: device.publicId,
        branchId: device.branchId,
        branchName: device.branch.name,
        enabled: device.enabled,
        status: this.computeStatus(
          device.enabled,
          lastHeartbeatAt,
          staleSeconds,
          offlineSeconds,
        ),
        lastSeenAt: device.lastSeenAt,
        lastHeartbeatAt,
        activeSessionId: activeSession?.id || null,
        sessionCount: device._count.sessions,
        eventCount: device._count.clockEvents,
      };
    });
  }

  /**
   * Get aggregated health metrics.
   */
  async getHealthMetrics(
    orgId: string,
    branchId?: string,
  ): Promise<HealthMetrics> {
    const devices = await this.getDevicesHealth(orgId, branchId);

    const metrics: HealthMetrics = {
      totalDevices: devices.length,
      onlineCount: 0,
      staleCount: 0,
      offlineCount: 0,
      disabledCount: 0,
      byBranch: {},
    };

    for (const device of devices) {
      // Update totals
      switch (device.status) {
        case DeviceHealthStatus.ONLINE:
          metrics.onlineCount++;
          break;
        case DeviceHealthStatus.STALE:
          metrics.staleCount++;
          break;
        case DeviceHealthStatus.OFFLINE:
          metrics.offlineCount++;
          break;
        case DeviceHealthStatus.DISABLED:
          metrics.disabledCount++;
          break;
      }

      // Update by branch
      if (!metrics.byBranch[device.branchId]) {
        metrics.byBranch[device.branchId] = {
          online: 0,
          stale: 0,
          offline: 0,
          disabled: 0,
        };
      }

      const branchMetrics = metrics.byBranch[device.branchId];
      switch (device.status) {
        case DeviceHealthStatus.ONLINE:
          branchMetrics.online++;
          break;
        case DeviceHealthStatus.STALE:
          branchMetrics.stale++;
          break;
        case DeviceHealthStatus.OFFLINE:
          branchMetrics.offline++;
          break;
        case DeviceHealthStatus.DISABLED:
          branchMetrics.disabled++;
          break;
      }
    }

    return metrics;
  }

  /**
   * Get health status for a specific device.
   */
  async getDeviceHealth(
    deviceId: string,
    orgId: string,
  ): Promise<DeviceHealthInfo | null> {
    // Get policy for thresholds
    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId },
    });

    const staleSeconds = policy?.kioskHeartbeatStaleSeconds ?? 120;
    const offlineSeconds = policy?.kioskHeartbeatOfflineSeconds ?? 900;

    const device = await this.prisma.client.kioskDevice.findFirst({
      where: {
        id: deviceId,
        orgId,
      },
      include: {
        branch: { select: { id: true, name: true } },
        sessions: {
          where: { endedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            sessions: true,
            clockEvents: true,
          },
        },
      },
    });

    if (!device) {
      return null;
    }

    const activeSession = device.sessions[0];
    const lastHeartbeatAt = activeSession?.lastHeartbeatAt || null;

    return {
      id: device.id,
      name: device.name,
      publicId: device.publicId,
      branchId: device.branchId,
      branchName: device.branch.name,
      enabled: device.enabled,
      status: this.computeStatus(
        device.enabled,
        lastHeartbeatAt,
        staleSeconds,
        offlineSeconds,
      ),
      lastSeenAt: device.lastSeenAt,
      lastHeartbeatAt,
      activeSessionId: activeSession?.id || null,
      sessionCount: device._count.sessions,
      eventCount: device._count.clockEvents,
    };
  }

  /**
   * End sessions that have exceeded heartbeat timeout.
   * Called on-demand, not via timer (H3).
   */
  async expireStaleSessionsForDevice(kioskDeviceId: string): Promise<number> {
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { id: kioskDeviceId },
      include: { org: true },
    });

    if (!device) {
      return 0;
    }

    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId: device.orgId },
    });

    const timeoutMinutes = policy?.kioskSessionTimeoutMinutes ?? 720;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const result = await this.prisma.client.kioskDeviceSession.updateMany({
      where: {
        kioskDeviceId,
        endedAt: null,
        lastHeartbeatAt: { lt: cutoff },
      },
      data: {
        endedAt: new Date(),
        endedReason: 'HEARTBEAT_EXPIRED',
      },
    });

    if (result.count > 0) {
      await this.auditService.logAction({
        orgId: device.orgId,
        performedById: 'SYSTEM',
        action: WorkforceAuditAction.KIOSK_SESSION_ENDED,
        entityType: 'KioskDeviceSession',
        entityId: kioskDeviceId,
        payload: {
          description: `${result.count} sessions expired due to heartbeat timeout`,
          kioskDeviceId,
          branchId: device.branchId,
          expiredCount: result.count,
          reason: 'HEARTBEAT_EXPIRED',
        },
      });
    }

    return result.count;
  }
}
