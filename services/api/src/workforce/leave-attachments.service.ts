/**
 * M10.18: Leave Attachments Service
 *
 * Manages attachment metadata for leave requests:
 * - URL validation (no javascript:, prefer HTTPS)
 * - RBAC: employee can manage own attachments while DRAFT/SUBMITTED
 * - Managers can add/remove anytime for compliance
 *
 * Note: Actual file storage is deferred; this stores metadata + external URLs only
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateAttachmentDto {
  label: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
}

// URL validation - block dangerous schemes and obvious internal IPs
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];
const INTERNAL_IP_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/0\.0\.0\.0/,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/169\.254\./, // Link-local
];

@Injectable()
export class LeaveAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate URL for security
   * Returns validation error message or null if valid
   */
  private validateUrl(url: string): string | null {
    // Check for blocked schemes
    const lowerUrl = url.toLowerCase().trim();
    for (const scheme of BLOCKED_SCHEMES) {
      if (lowerUrl.startsWith(scheme)) {
        return `URL scheme '${scheme.replace(':', '')}' is not allowed`;
      }
    }

    // Check for internal IPs (basic SSRF protection)
    for (const pattern of INTERNAL_IP_PATTERNS) {
      if (pattern.test(url)) {
        return 'URLs pointing to internal/localhost addresses are not allowed';
      }
    }

    // Prefer HTTPS (warn but don't block HTTP for now)
    if (lowerUrl.startsWith('http://')) {
      // Allow but could log warning in production
    }

    // Must be http or https
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return 'URL must start with http:// or https://';
    }

    return null;
  }

  /**
   * Add attachment to a leave request
   */
  async addAttachment(
    orgId: string,
    leaveRequestId: string,
    dto: CreateAttachmentDto,
    actorId: string,
    actorRoleLevel: number,
  ): Promise<any> {
    // Get the leave request
    const request = await this.prisma.client.leaveRequestV2.findFirst({
      where: { id: leaveRequestId, orgId },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    // RBAC check
    const isOwner = request.userId === actorId;
    const isManager = actorRoleLevel >= 3;
    const isEditableByOwner = ['DRAFT', 'SUBMITTED'].includes(request.status);

    if (!isManager && (!isOwner || !isEditableByOwner)) {
      throw new ForbiddenException(
        'You can only add attachments to your own DRAFT or SUBMITTED requests',
      );
    }

    // Validate URL if provided
    if (dto.url) {
      const urlError = this.validateUrl(dto.url);
      if (urlError) {
        throw new BadRequestException(urlError);
      }
    }

    // Validate label
    if (!dto.label || dto.label.trim().length === 0) {
      throw new BadRequestException('Attachment label is required');
    }

    return this.prisma.client.leaveRequestAttachment.create({
      data: {
        orgId,
        leaveRequestId,
        label: dto.label.trim(),
        url: dto.url?.trim() || null,
        mimeType: dto.mimeType || null,
        sizeBytes: dto.sizeBytes || null,
        addedById: actorId,
      },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * List attachments for a leave request
   */
  async listAttachments(
    orgId: string,
    leaveRequestId: string,
  ): Promise<any[]> {
    return this.prisma.client.leaveRequestAttachment.findMany({
      where: { orgId, leaveRequestId },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single attachment
   */
  async getAttachment(orgId: string, attachmentId: string): Promise<any> {
    const attachment = await this.prisma.client.leaveRequestAttachment.findFirst({
      where: { id: attachmentId, orgId },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
        leaveRequest: { select: { id: true, userId: true, status: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(
    orgId: string,
    attachmentId: string,
    actorId: string,
    actorRoleLevel: number,
  ): Promise<void> {
    const attachment = await this.prisma.client.leaveRequestAttachment.findFirst({
      where: { id: attachmentId, orgId },
      include: {
        leaveRequest: { select: { id: true, userId: true, status: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // RBAC check
    const isOwner = attachment.leaveRequest.userId === actorId;
    const isManager = actorRoleLevel >= 3;
    const isEditableByOwner = ['DRAFT', 'SUBMITTED'].includes(attachment.leaveRequest.status);

    if (!isManager && (!isOwner || !isEditableByOwner)) {
      throw new ForbiddenException(
        'You can only delete attachments from your own DRAFT or SUBMITTED requests',
      );
    }

    await this.prisma.client.leaveRequestAttachment.delete({
      where: { id: attachmentId },
    });
  }
}
