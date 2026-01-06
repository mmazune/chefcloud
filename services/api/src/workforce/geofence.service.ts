/**
 * M10.20: Workforce Geo-Fencing Service
 *
 * Handles branch geo-fence configuration, enforcement with Haversine distance calculation,
 * manager override workflows, and event logging.
 *
 * Kimai Parity: location_constraint table pattern with perimeter enforcement.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

// Reason codes for enforcement events
export const GEOFENCE_REASON_CODES = {
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
  ACCURACY_TOO_LOW: 'ACCURACY_TOO_LOW',
  MISSING_LOCATION: 'MISSING_LOCATION',
} as const;

export type GeoFenceReasonCode = typeof GEOFENCE_REASON_CODES[keyof typeof GEOFENCE_REASON_CODES];

// Event types for geo-fence events
export const GEOFENCE_EVENT_TYPES = {
  BLOCKED: 'BLOCKED',
  OVERRIDE: 'OVERRIDE',
  ALLOWED: 'ALLOWED',
} as const;

export type GeoFenceEventType = typeof GEOFENCE_EVENT_TYPES[keyof typeof GEOFENCE_EVENT_TYPES];

// Earth radius in meters (WGS84)
const EARTH_RADIUS_METERS = 6_371_008.8;

// DTOs
export interface GeoFenceConfigDto {
  branchId: string;
  enabled: boolean;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  enforceClockIn: boolean;
  enforceClockOut: boolean;
  allowManagerOverride: boolean;
  maxAccuracyMeters?: number;
}

export interface GeoFenceEnforcementResult {
  allowed: boolean;
  distanceMeters?: number;
  reasonCode?: GeoFenceReasonCode;
  requiresOverride: boolean;
  canOverride: boolean;
}

export interface GeoFenceOverrideDto {
  timeEntryId: string;
  clockAction: 'CLOCK_IN' | 'CLOCK_OUT';
  reason: string;
}

@Injectable()
export class GeoFenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * H1: Haversine distance calculation with proper rounding.
   * Returns distance in meters between two lat/lng points.
   *
   * Formula: a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
   *          c = 2 ⋅ atan2(√a, √(1−a))
   *          d = R ⋅ c
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Convert to radians
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lng2 - lng1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // H1: Round to 2 decimal places to avoid floating-point edge cases
    return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
  }

  // ===== Geo-Fence Configuration CRUD =====

  async getGeoFenceConfig(orgId: string, branchId: string) {
    const config = await this.prisma.client.branchGeoFence.findUnique({
      where: { branchId },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (config && config.orgId !== orgId) {
      throw new ForbiddenException('Branch geo-fence belongs to another organization');
    }

    return config;
  }

  async upsertGeoFenceConfig(
    orgId: string,
    userId: string,
    dto: GeoFenceConfigDto,
  ) {
    // Validate branch belongs to org
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.orgId !== orgId) {
      throw new ForbiddenException('Branch belongs to another organization');
    }

    // Validate coordinates
    if (dto.centerLat < -90 || dto.centerLat > 90) {
      throw new BadRequestException('Center latitude must be between -90 and 90');
    }
    if (dto.centerLng < -180 || dto.centerLng > 180) {
      throw new BadRequestException('Center longitude must be between -180 and 180');
    }
    if (dto.radiusMeters < 10) {
      throw new BadRequestException('Radius must be at least 10 meters');
    }
    if (dto.radiusMeters > 50000) {
      throw new BadRequestException('Radius must be at most 50000 meters (50km)');
    }

    // H7: Default maxAccuracyMeters to 200 if not provided
    const maxAccuracyMeters = dto.maxAccuracyMeters ?? 200;

    const existing = await this.prisma.client.branchGeoFence.findUnique({
      where: { branchId: dto.branchId },
    });

    const config = await this.prisma.client.branchGeoFence.upsert({
      where: { branchId: dto.branchId },
      create: {
        orgId,
        branchId: dto.branchId,
        enabled: dto.enabled,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusMeters: dto.radiusMeters,
        enforceClockIn: dto.enforceClockIn,
        enforceClockOut: dto.enforceClockOut,
        allowManagerOverride: dto.allowManagerOverride,
        maxAccuracyMeters,
        createdById: userId,
        updatedById: userId,
      },
      update: {
        enabled: dto.enabled,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusMeters: dto.radiusMeters,
        enforceClockIn: dto.enforceClockIn,
        enforceClockOut: dto.enforceClockOut,
        allowManagerOverride: dto.allowManagerOverride,
        maxAccuracyMeters,
        updatedById: userId,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: existing ? WorkforceAuditAction.GEOFENCE_CONFIG_UPDATED : WorkforceAuditAction.GEOFENCE_CONFIG_CREATED,
      entityType: 'BranchGeoFence',
      entityId: config.id,
      payload: {
        branchId: dto.branchId,
        enabled: dto.enabled,
        radiusMeters: dto.radiusMeters,
        enforceClockIn: dto.enforceClockIn,
        enforceClockOut: dto.enforceClockOut,
        allowManagerOverride: dto.allowManagerOverride,
        maxAccuracyMeters,
      },
    });

    return config;
  }

  async deleteGeoFenceConfig(orgId: string, branchId: string, userId: string) {
    const config = await this.prisma.client.branchGeoFence.findUnique({
      where: { branchId },
    });

    if (!config) {
      throw new NotFoundException('Geo-fence configuration not found');
    }

    if (config.orgId !== orgId) {
      throw new ForbiddenException('Branch geo-fence belongs to another organization');
    }

    await this.prisma.client.branchGeoFence.delete({
      where: { branchId },
    });

    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.GEOFENCE_CONFIG_DELETED,
      entityType: 'BranchGeoFence',
      entityId: config.id,
      payload: { branchId },
    });

    return { success: true };
  }

  async listGeoFenceConfigs(orgId: string) {
    return this.prisma.client.branchGeoFence.findMany({
      where: { orgId },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ===== Enforcement Logic =====

  /**
   * Check if clock-in/out is allowed based on geo-fence configuration.
   *
   * H2: Accuracy gating with configurable threshold (default 200m for indoor GPS).
   * H1: Haversine distance with proper rounding.
   */
  async checkEnforcement(
    orgId: string,
    branchId: string,
    clockAction: 'CLOCK_IN' | 'CLOCK_OUT',
    location?: { lat: number; lng: number; accuracyMeters?: number },
    userRoleLevel?: number,
  ): Promise<GeoFenceEnforcementResult> {
    // Get geo-fence config for branch
    const config = await this.prisma.client.branchGeoFence.findUnique({
      where: { branchId },
    });

    // No config or disabled = always allowed
    if (!config || !config.enabled) {
      return { allowed: true, requiresOverride: false, canOverride: false };
    }

    // Check if enforcement applies to this action
    const enforceAction =
      clockAction === 'CLOCK_IN' ? config.enforceClockIn : config.enforceClockOut;

    if (!enforceAction) {
      return { allowed: true, requiresOverride: false, canOverride: false };
    }

    // H2: Check if location is provided
    if (!location || location.lat === undefined || location.lng === undefined) {
      return {
        allowed: false,
        reasonCode: GEOFENCE_REASON_CODES.MISSING_LOCATION,
        requiresOverride: true,
        canOverride: config.allowManagerOverride,
      };
    }

    // H2: Check accuracy threshold (H7: default 200m for indoor GPS tolerance)
    const maxAccuracy = config.maxAccuracyMeters ?? 200;
    if (location.accuracyMeters !== undefined && location.accuracyMeters > maxAccuracy) {
      return {
        allowed: false,
        reasonCode: GEOFENCE_REASON_CODES.ACCURACY_TOO_LOW,
        requiresOverride: true,
        canOverride: config.allowManagerOverride,
      };
    }

    // H1: Calculate distance using Haversine
    const distanceMeters = this.calculateDistance(
      location.lat,
      location.lng,
      Number(config.centerLat),
      Number(config.centerLng),
    );

    // Check if within radius
    if (distanceMeters <= config.radiusMeters) {
      return {
        allowed: true,
        distanceMeters,
        requiresOverride: false,
        canOverride: false,
      };
    }

    // Outside geo-fence
    return {
      allowed: false,
      distanceMeters,
      reasonCode: GEOFENCE_REASON_CODES.OUTSIDE_GEOFENCE,
      requiresOverride: true,
      canOverride: config.allowManagerOverride,
    };
  }

  // ===== Event Logging =====

  async logEvent(
    orgId: string,
    branchId: string,
    userId: string,
    eventType: GeoFenceEventType,
    clockAction: 'CLOCK_IN' | 'CLOCK_OUT',
    data: {
      reasonCode?: GeoFenceReasonCode;
      lat?: number;
      lng?: number;
      accuracyMeters?: number;
      distanceMeters?: number;
      radiusMeters?: number;
      overrideById?: string;
      overrideReason?: string;
    },
  ) {
    return this.prisma.client.geoFenceEvent.create({
      data: {
        orgId,
        branchId,
        userId,
        eventType,
        reasonCode: data.reasonCode,
        clockAction,
        lat: data.lat,
        lng: data.lng,
        accuracyMeters: data.accuracyMeters,
        distanceMeters: data.distanceMeters,
        radiusMeters: data.radiusMeters,
        overrideById: data.overrideById,
        overrideReason: data.overrideReason,
      },
    });
  }

  // ===== Manager Override =====

  /**
   * H3: Manager override for blocked clock-in/out.
   * Requires L3+ role level.
   */
  async applyOverride(
    orgId: string,
    managerId: string,
    managerRoleLevel: number,
    dto: GeoFenceOverrideDto,
  ) {
    // H3: Require L3+ for overrides
    if (managerRoleLevel < 3) {
      throw new ForbiddenException('Manager override requires L3 or higher role level');
    }

    // Validate reason
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('Override reason must be at least 10 characters');
    }

    // Get time entry
    const timeEntry = await this.prisma.client.timeEntry.findUnique({
      where: { id: dto.timeEntryId },
      include: { user: true },
    });

    if (!timeEntry) {
      throw new NotFoundException('Time entry not found');
    }

    if (timeEntry.orgId !== orgId) {
      throw new ForbiddenException('Time entry belongs to another organization');
    }

    // Check geo-fence config allows overrides
    const config = await this.prisma.client.branchGeoFence.findUnique({
      where: { branchId: timeEntry.branchId },
    });

    if (config && !config.allowManagerOverride) {
      throw new ForbiddenException('Manager overrides are disabled for this branch');
    }

    // Apply override based on clock action
    const updateData =
      dto.clockAction === 'CLOCK_IN'
        ? {
          clockInOverride: true,
          clockInOverrideReason: dto.reason,
          clockInOverrideById: managerId,
        }
        : {
          clockOutOverride: true,
          clockOutOverrideReason: dto.reason,
          clockOutOverrideById: managerId,
        };

    const updated = await this.prisma.client.timeEntry.update({
      where: { id: dto.timeEntryId },
      data: updateData,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log event
    await this.logEvent(
      orgId,
      timeEntry.branchId,
      timeEntry.userId,
      GEOFENCE_EVENT_TYPES.OVERRIDE,
      dto.clockAction,
      {
        overrideById: managerId,
        overrideReason: dto.reason,
      },
    );

    // Audit log
    const auditAction =
      dto.clockAction === 'CLOCK_IN'
        ? WorkforceAuditAction.GEOFENCE_OVERRIDE_CLOCKIN
        : WorkforceAuditAction.GEOFENCE_OVERRIDE_CLOCKOUT;

    await this.auditService.logAction({
      orgId,
      performedById: managerId,
      action: auditAction,
      entityType: 'TimeEntry',
      entityId: timeEntry.id,
      payload: {
        branchId: timeEntry.branchId,
        overrideReason: dto.reason,
        employeeId: timeEntry.userId,
        employeeName: `${timeEntry.user?.firstName} ${timeEntry.user?.lastName}`,
      },
    });

    return updated;
  }

  // ===== Reporting KPIs =====

  async getEnforcementKpis(
    orgId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Aggregate events by type
    const events = await this.prisma.client.geoFenceEvent.groupBy({
      by: ['eventType', 'reasonCode', 'clockAction'],
      where,
      _count: { id: true },
    });

    // Calculate KPIs
    const totalBlocked = events
      .filter((e) => e.eventType === 'BLOCKED')
      .reduce((sum, e) => sum + e._count.id, 0);

    const totalOverrides = events
      .filter((e) => e.eventType === 'OVERRIDE')
      .reduce((sum, e) => sum + e._count.id, 0);

    const totalAllowed = events
      .filter((e) => e.eventType === 'ALLOWED')
      .reduce((sum, e) => sum + e._count.id, 0);

    const blockedByReason = events
      .filter((e) => e.eventType === 'BLOCKED')
      .reduce(
        (acc, e) => {
          const key = e.reasonCode ?? 'UNKNOWN';
          acc[key] = (acc[key] ?? 0) + e._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      totalAttempts: totalBlocked + totalOverrides + totalAllowed,
      totalBlocked,
      totalOverrides,
      totalAllowed,
      blockedByReason,
      overrideRate:
        totalBlocked > 0 ? Math.round((totalOverrides / totalBlocked) * 100) / 100 : 0,
      byClockAction: {
        clockIn: events.filter((e) => e.clockAction === 'CLOCK_IN').reduce((sum, e) => sum + e._count.id, 0),
        clockOut: events.filter((e) => e.clockAction === 'CLOCK_OUT').reduce((sum, e) => sum + e._count.id, 0),
      },
    };
  }

  async getEventHistory(
    orgId: string,
    options: {
      branchId?: string;
      userId?: string;
      eventType?: GeoFenceEventType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { orgId };

    if (options.branchId) where.branchId = options.branchId;
    if (options.userId) where.userId = options.userId;
    if (options.eventType) where.eventType = options.eventType;

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [events, total] = await Promise.all([
      this.prisma.client.geoFenceEvent.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true } },
          overrideBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.client.geoFenceEvent.count({ where }),
    ]);

    return { events, total };
  }
}
