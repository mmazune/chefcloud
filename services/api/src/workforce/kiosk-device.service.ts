/**
 * M10.21: Kiosk Device Service
 *
 * Handles device enrollment, secret management, and CRUD operations.
 * Follows H2 (atomic secret rotation) and H7 (branch binding).
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from '../auth/auth.helpers';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

// Public ID length (URL-safe identifier)
const PUBLIC_ID_LENGTH = 16;

// Device secret length (hex-encoded)
const SECRET_LENGTH = 32;

@Injectable()
export class KioskDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * Generate a URL-safe public ID
   */
  private generatePublicId(): string {
    return randomBytes(PUBLIC_ID_LENGTH / 2).toString('hex');
  }

  /**
   * Generate a device secret (hex-encoded)
   */
  private generateSecret(): string {
    return randomBytes(SECRET_LENGTH).toString('hex');
  }

  /**
   * Create a new kiosk device.
   * Returns the device with a one-time plaintext secret.
   */
  async createDevice(data: {
    orgId: string;
    branchId: string;
    name: string;
    createdById: string;
    allowedIpCidrs?: string[];
  }): Promise<{ device: any; plaintextSecret: string }> {
    // Validate branch belongs to org
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: data.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.orgId !== data.orgId) {
      throw new ForbiddenException('Branch belongs to another organization');
    }

    // Validate name is not empty
    if (!data.name || data.name.trim().length < 3) {
      throw new BadRequestException('Device name must be at least 3 characters');
    }

    // Generate identifiers
    const publicId = this.generatePublicId();
    const plaintextSecret = this.generateSecret();
    const secretHash = await AuthHelpers.hashPassword(plaintextSecret);

    // Create device
    const device = await this.prisma.client.kioskDevice.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        name: data.name.trim(),
        publicId,
        secretHash,
        allowedIpCidrs: data.allowedIpCidrs ?? [],
        createdById: data.createdById,
      },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId: data.orgId,
      performedById: data.createdById,
      action: WorkforceAuditAction.KIOSK_DEVICE_CREATED,
      entityType: 'KioskDevice',
      entityId: device.id,
      payload: {
        branchId: data.branchId,
        name: data.name,
        publicId,
      },
    });

    // Return device with one-time secret (NEVER stored in plaintext)
    return {
      device: {
        id: device.id,
        orgId: device.orgId,
        branchId: device.branchId,
        name: device.name,
        publicId: device.publicId,
        enabled: device.enabled,
        allowedIpCidrs: device.allowedIpCidrs,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
        branch: device.branch,
        createdBy: device.createdBy,
      },
      plaintextSecret,
    };
  }

  /**
   * Rotate device secret atomically.
   * H2: Invalidates all existing sessions in the same transaction.
   */
  async rotateSecret(
    deviceId: string,
    orgId: string,
    performedById: string,
  ): Promise<{ device: any; plaintextSecret: string }> {
    // Verify device exists and belongs to org
    const existingDevice = await this.prisma.client.kioskDevice.findUnique({
      where: { id: deviceId },
    });

    if (!existingDevice) {
      throw new NotFoundException('Kiosk device not found');
    }

    if (existingDevice.orgId !== orgId) {
      throw new ForbiddenException('Device belongs to another organization');
    }

    // Generate new secret
    const plaintextSecret = this.generateSecret();
    const secretHash = await AuthHelpers.hashPassword(plaintextSecret);

    // H2: Atomic rotation - update hash + invalidate all sessions
    const [device] = await this.prisma.client.$transaction([
      this.prisma.client.kioskDevice.update({
        where: { id: deviceId },
        data: { secretHash },
        include: {
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.kioskDeviceSession.updateMany({
        where: { kioskDeviceId: deviceId, endedAt: null },
        data: { endedAt: new Date(), endedReason: 'ROTATED' },
      }),
    ]);

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.KIOSK_DEVICE_SECRET_ROTATED,
      entityType: 'KioskDevice',
      entityId: deviceId,
      payload: { branchId: device.branchId },
    });

    return {
      device: {
        id: device.id,
        orgId: device.orgId,
        branchId: device.branchId,
        name: device.name,
        publicId: device.publicId,
        enabled: device.enabled,
        allowedIpCidrs: device.allowedIpCidrs,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
        branch: device.branch,
      },
      plaintextSecret,
    };
  }

  /**
   * Validate device secret (for authentication).
   */
  async validateDeviceSecret(
    publicId: string,
    plaintextSecret: string,
  ): Promise<{ device: any } | null> {
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { publicId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!device) {
      return null;
    }

    if (!device.enabled) {
      return null;
    }

    const isValid = await AuthHelpers.verifyPassword(device.secretHash, plaintextSecret);
    if (!isValid) {
      return null;
    }

    // Update lastSeenAt
    await this.prisma.client.kioskDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return { device };
  }

  /**
   * Update device (name, enabled, allowedIpCidrs).
   */
  async updateDevice(
    deviceId: string,
    orgId: string,
    performedById: string,
    updates: {
      name?: string;
      enabled?: boolean;
      allowedIpCidrs?: string[];
    },
  ) {
    const existingDevice = await this.prisma.client.kioskDevice.findUnique({
      where: { id: deviceId },
    });

    if (!existingDevice) {
      throw new NotFoundException('Kiosk device not found');
    }

    if (existingDevice.orgId !== orgId) {
      throw new ForbiddenException('Device belongs to another organization');
    }

    // Validate name if provided
    if (updates.name !== undefined && updates.name.trim().length < 3) {
      throw new BadRequestException('Device name must be at least 3 characters');
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.allowedIpCidrs !== undefined) updateData.allowedIpCidrs = updates.allowedIpCidrs;

    const device = await this.prisma.client.kioskDevice.update({
      where: { id: deviceId },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Determine audit action
    const action = updates.enabled === false
      ? WorkforceAuditAction.KIOSK_DEVICE_DISABLED
      : WorkforceAuditAction.KIOSK_DEVICE_UPDATED;

    await this.auditService.logAction({
      orgId,
      performedById,
      action,
      entityType: 'KioskDevice',
      entityId: deviceId,
      payload: updates,
    });

    return device;
  }

  /**
   * Delete device.
   */
  async deleteDevice(
    deviceId: string,
    orgId: string,
    performedById: string,
  ) {
    const existingDevice = await this.prisma.client.kioskDevice.findUnique({
      where: { id: deviceId },
    });

    if (!existingDevice) {
      throw new NotFoundException('Kiosk device not found');
    }

    if (existingDevice.orgId !== orgId) {
      throw new ForbiddenException('Device belongs to another organization');
    }

    await this.prisma.client.kioskDevice.delete({
      where: { id: deviceId },
    });

    await this.auditService.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.KIOSK_DEVICE_DELETED,
      entityType: 'KioskDevice',
      entityId: deviceId,
      payload: {
        branchId: existingDevice.branchId,
        name: existingDevice.name,
      },
    });

    return { success: true };
  }

  /**
   * List devices for org (optionally filtered by branch).
   */
  async listDevices(orgId: string, branchId?: string) {
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.client.kioskDevice.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: { sessions: true, clockEvents: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get device by ID.
   */
  async getDevice(deviceId: string, orgId: string) {
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { id: deviceId },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: { sessions: true, clockEvents: true, pinAttempts: true },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Kiosk device not found');
    }

    if (device.orgId !== orgId) {
      throw new ForbiddenException('Device belongs to another organization');
    }

    return device;
  }

  /**
   * Get device by public ID (for public endpoints).
   */
  async getDeviceByPublicId(publicId: string) {
    const device = await this.prisma.client.kioskDevice.findUnique({
      where: { publicId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!device || !device.enabled) {
      return null;
    }

    return device;
  }
}
