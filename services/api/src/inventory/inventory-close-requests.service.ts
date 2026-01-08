/**
 * M12.4 Inventory Close Requests Service
 *
 * Manages period close request lifecycle:
 * - Create/submit requests (L4+)
 * - Approve/reject requests (L5+)
 * - Force-close bypass with audit trail (L5+)
 * - Alert creation on key transitions
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryPeriodEventsService } from './inventory-period-events.service';
import { InventoryAlertsService } from './inventory-alerts.service';
import {
  InventoryPeriodCloseRequestStatus,
  InventoryPeriodEventType,
  InventoryAlertType,
  InventoryAlertSeverity,
  RoleLevel,
} from '@chefcloud/db';

// ============================================
// DTOs
// ============================================

export interface CreateCloseRequestDto {
  periodId: string;
}

export interface SubmitCloseRequestDto {
  requestId: string;
}

export interface ApproveCloseRequestDto {
  requestId: string;
  notes?: string;
}

export interface RejectCloseRequestDto {
  requestId: string;
  reason: string;
}

export interface CloseRequestListFilters {
  branchId?: string;
  status?: InventoryPeriodCloseRequestStatus;
}

export interface CloseRequestItem {
  id: string;
  orgId: string;
  branchId: string;
  periodId: string;
  status: InventoryPeriodCloseRequestStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: Date | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  approvalNotes: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
    status: string;
  };
  branch: {
    name: string;
  };
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryCloseRequestsService {
  private readonly logger = new Logger(InventoryCloseRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: InventoryPeriodEventsService,
    private readonly alertsService: InventoryAlertsService,
  ) {}

  // ============================================
  // Create Close Request
  // ============================================

  async createCloseRequest(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateCloseRequestDto,
  ): Promise<CloseRequestItem> {
    // Validate period exists and is OPEN
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: dto.periodId, orgId, branchId },
      include: { branch: true },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    if (period.status !== 'OPEN') {
      throw new BadRequestException('Cannot create close request for non-OPEN period');
    }

    // Check for existing request (unique constraint)
    const existing = await this.prisma.client.inventoryPeriodCloseRequest.findUnique({
      where: { periodId: dto.periodId },
    });

    if (existing) {
      throw new ConflictException('Close request already exists for this period');
    }

    // Create request
    const request = await this.prisma.client.inventoryPeriodCloseRequest.create({
      data: {
        orgId,
        branchId,
        periodId: dto.periodId,
        requestedById: userId,
        status: 'DRAFT',
      },
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
    });

    // Log event
    await this.eventsService.logEvent({
      orgId,
      branchId,
      periodId: dto.periodId,
      type: InventoryPeriodEventType.CLOSE_REQUEST_CREATED,
      actorUserId: userId,
      metadataJson: { requestId: request.id },
    });

    return this.mapRequest(request);
  }

  // ============================================
  // Submit Close Request
  // ============================================

  async submitCloseRequest(
    orgId: string,
    userId: string,
    dto: SubmitCloseRequestDto,
  ): Promise<CloseRequestItem> {
    const request = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { id: dto.requestId, orgId },
      include: { period: true, branch: true },
    });

    if (!request) {
      throw new NotFoundException('Close request not found');
    }

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT requests can be submitted');
    }

    // Update request
    const updated = await this.prisma.client.inventoryPeriodCloseRequest.update({
      where: { id: dto.requestId },
      data: {
        status: 'SUBMITTED',
        requestedAt: new Date(),
      },
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
    });

    // Log event
    await this.eventsService.logEvent({
      orgId,
      branchId: request.branchId,
      periodId: request.periodId,
      type: InventoryPeriodEventType.CLOSE_REQUEST_SUBMITTED,
      actorUserId: userId,
      metadataJson: { requestId: request.id },
    });

    // Create approval required alert
    await this.createOrUpdateAlert(
      orgId,
      request.branchId,
      request.periodId,
      InventoryAlertType.PERIOD_CLOSE_APPROVAL_REQ,
      InventoryAlertSeverity.WARN,
      `Close request submitted for period ${request.period.startDate.toISOString().slice(0, 10)} - ${request.period.endDate.toISOString().slice(0, 10)}`,
    );

    return this.mapRequest(updated);
  }

  // ============================================
  // Approve Close Request
  // ============================================

  async approveCloseRequest(
    orgId: string,
    userId: string,
    userRoleLevel: RoleLevel,
    dto: ApproveCloseRequestDto,
  ): Promise<CloseRequestItem> {
    // Require L5+
    if (userRoleLevel < RoleLevel.L5) {
      throw new ForbiddenException('L5+ required to approve close requests');
    }

    const request = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { id: dto.requestId, orgId },
      include: { period: true, branch: true },
    });

    if (!request) {
      throw new NotFoundException('Close request not found');
    }

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED requests can be approved');
    }

    // Update request
    const updated = await this.prisma.client.inventoryPeriodCloseRequest.update({
      where: { id: dto.requestId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        approvalNotes: dto.notes,
      },
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
    });

    // Log event
    await this.eventsService.logEvent({
      orgId,
      branchId: request.branchId,
      periodId: request.periodId,
      type: InventoryPeriodEventType.CLOSE_REQUEST_APPROVED,
      actorUserId: userId,
      metadataJson: { requestId: request.id, notes: dto.notes },
    });

    // Resolve approval required alert
    await this.resolveAlerts(orgId, request.branchId, request.periodId, userId);

    return this.mapRequest(updated);
  }

  // ============================================
  // Reject Close Request
  // ============================================

  async rejectCloseRequest(
    orgId: string,
    userId: string,
    userRoleLevel: RoleLevel,
    dto: RejectCloseRequestDto,
  ): Promise<CloseRequestItem> {
    // Require L5+
    if (userRoleLevel < RoleLevel.L5) {
      throw new ForbiddenException('L5+ required to reject close requests');
    }

    if (!dto.reason || dto.reason.length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    const request = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { id: dto.requestId, orgId },
      include: { period: true, branch: true },
    });

    if (!request) {
      throw new NotFoundException('Close request not found');
    }

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED requests can be rejected');
    }

    // Update request
    const updated = await this.prisma.client.inventoryPeriodCloseRequest.update({
      where: { id: dto.requestId },
      data: {
        status: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
    });

    // Log event
    await this.eventsService.logEvent({
      orgId,
      branchId: request.branchId,
      periodId: request.periodId,
      type: InventoryPeriodEventType.CLOSE_REQUEST_REJECTED,
      actorUserId: userId,
      reason: dto.reason,
      metadataJson: { requestId: request.id },
    });

    // Resolve approval required alert
    await this.resolveAlerts(orgId, request.branchId, request.periodId, userId);

    return this.mapRequest(updated);
  }

  // ============================================
  // List Close Requests
  // ============================================

  async listCloseRequests(
    orgId: string,
    filters: CloseRequestListFilters,
  ): Promise<CloseRequestItem[]> {
    const where: any = { orgId };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const requests = await this.prisma.client.inventoryPeriodCloseRequest.findMany({
      where,
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(this.mapRequest);
  }

  // ============================================
  // Get Close Request For Period
  // ============================================

  async getCloseRequestForPeriod(
    orgId: string,
    periodId: string,
  ): Promise<CloseRequestItem | null> {
    const request = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { orgId, periodId },
      include: {
        requestedBy: true,
        approvedBy: true,
        period: true,
        branch: true,
      },
    });

    return request ? this.mapRequest(request) : null;
  }

  // ============================================
  // Validate Approval For Close
  // ============================================

  async validateApprovalForClose(
    orgId: string,
    periodId: string,
    forceClose: boolean,
    forceCloseReason?: string,
    userId?: string,
    userRoleLevel?: RoleLevel,
  ): Promise<{ approved: boolean; forceUsed: boolean; error?: string }> {
    const request = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { orgId, periodId },
    });

    // If approved request exists, allow close
    if (request?.status === 'APPROVED') {
      return { approved: true, forceUsed: false };
    }

    // If force close requested
    if (forceClose) {
      if (!userRoleLevel || userRoleLevel < RoleLevel.L5) {
        return { approved: false, forceUsed: false, error: 'L5+ required for force close' };
      }

      if (!forceCloseReason || forceCloseReason.length < 10) {
        return { approved: false, forceUsed: false, error: 'Force close reason must be at least 10 characters' };
      }

      // Log force close event
      const period = await this.prisma.client.inventoryPeriod.findUnique({
        where: { id: periodId },
      });

      if (period && userId) {
        await this.eventsService.logEvent({
          orgId,
          branchId: period.branchId,
          periodId,
          type: InventoryPeriodEventType.FORCE_CLOSE_USED,
          actorUserId: userId,
          reason: forceCloseReason,
          metadataJson: { requestId: request?.id || null },
        });
      }

      return { approved: true, forceUsed: true };
    }

    // No approval and no force close
    return {
      approved: false,
      forceUsed: false,
      error: request?.status === 'SUBMITTED'
        ? 'Close request is pending approval'
        : request?.status === 'REJECTED'
          ? 'Close request was rejected'
          : 'Approved close request required',
    };
  }

  // ============================================
  // Alert Helpers
  // ============================================

  private async createOrUpdateAlert(
    orgId: string,
    branchId: string,
    periodId: string,
    type: InventoryAlertType,
    severity: InventoryAlertSeverity,
    title: string,
  ): Promise<void> {
    // Use upsert pattern with unique key
    const existing = await this.prisma.client.inventoryAlert.findFirst({
      where: {
        orgId,
        branchId,
        type,
        entityType: 'PERIOD',
        entityId: periodId,
        status: 'OPEN',
      },
    });

    if (existing) {
      // Update existing
      await this.prisma.client.inventoryAlert.update({
        where: { id: existing.id },
        data: { title, severity, updatedAt: new Date() },
      });
    } else {
      // Create new
      await this.prisma.client.inventoryAlert.create({
        data: {
          orgId,
          branchId,
          type,
          entityType: 'PERIOD',
          entityId: periodId,
          severity,
          title,
          status: 'OPEN',
        },
      });
    }
  }

  private async resolveAlerts(
    orgId: string,
    branchId: string,
    periodId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.client.inventoryAlert.updateMany({
      where: {
        orgId,
        branchId,
        entityType: 'PERIOD',
        entityId: periodId,
        status: 'OPEN',
        type: { in: ['PERIOD_CLOSE_BLOCKED', 'PERIOD_CLOSE_APPROVAL_REQ'] },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });
  }

  // ============================================
  // Create Blocked Alert (for preclose)
  // ============================================

  async createBlockedAlert(
    orgId: string,
    branchId: string,
    periodId: string,
    blockerCount: number,
    blockerSummary: string[],
  ): Promise<void> {
    const severity = blockerCount > 5 ? InventoryAlertSeverity.CRITICAL : InventoryAlertSeverity.WARN;
    const title = `Period close blocked: ${blockerCount} issue(s) - ${blockerSummary.slice(0, 3).join(', ')}`;

    await this.createOrUpdateAlert(
      orgId,
      branchId,
      periodId,
      InventoryAlertType.PERIOD_CLOSE_BLOCKED,
      severity,
      title,
    );
  }

  // ============================================
  // Mapper
  // ============================================

  private mapRequest(request: any): CloseRequestItem {
    return {
      id: request.id,
      orgId: request.orgId,
      branchId: request.branchId,
      periodId: request.periodId,
      status: request.status,
      requestedById: request.requestedById,
      requestedByName: request.requestedBy
        ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
        : 'Unknown',
      requestedAt: request.requestedAt,
      approvedById: request.approvedById,
      approvedByName: request.approvedBy
        ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}`
        : null,
      approvedAt: request.approvedAt,
      approvalNotes: request.approvalNotes,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
      period: {
        startDate: request.period.startDate,
        endDate: request.period.endDate,
        status: request.period.status,
      },
      branch: {
        name: request.branch.name,
      },
    };
  }
}
