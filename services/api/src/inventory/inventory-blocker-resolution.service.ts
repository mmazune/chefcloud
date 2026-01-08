/**
 * M12.7: Blocker Resolution Service
 *
 * RBAC-controlled endpoints to resolve period close blockers:
 * - POST_STOCKTAKE, VOID_STOCKTAKE
 * - POST_RECEIPT, VOID_RECEIPT
 * - POST_WASTE, VOID_WASTE
 * - RETRY_GL_POSTING
 * - CREATE_CLOSE_REQUEST
 *
 * Features:
 * - Idempotent resolutions (H3)
 * - Notification emission on resolution (M12.6 infrastructure)
 * - Audit trail via period events
 */
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryCloseNotificationsService } from './inventory-close-notifications.service';
import { InventoryPeriodEventsService } from './inventory-period-events.service';
import { InventoryPeriodEventType, RoleLevel } from '@chefcloud/db';

// ============================================
// Types
// ============================================

export type ResolveAction =
  | 'VOID_STOCKTAKE'
  | 'POST_STOCKTAKE'
  | 'POST_RECEIPT'
  | 'VOID_RECEIPT'
  | 'POST_WASTE'
  | 'VOID_WASTE'
  | 'RETRY_GL_POSTING'
  | 'CREATE_CLOSE_REQUEST'
  | 'OVERRIDE_BLOCKER';

export interface ResolveBlockerDto {
  type: string;
  action: ResolveAction;
  entityId?: string;
  notes?: string;
}

export interface ResolveResult {
  success: boolean;
  action: string;
  entityId?: string;
  message: string;
  idempotent: boolean; // true if already resolved
}

// RBAC requirements per action
const ACTION_RBAC: Record<ResolveAction, RoleLevel> = {
  VOID_STOCKTAKE: 'L4',
  POST_STOCKTAKE: 'L4',
  POST_RECEIPT: 'L3',
  VOID_RECEIPT: 'L4',
  POST_WASTE: 'L3',
  VOID_WASTE: 'L4',
  RETRY_GL_POSTING: 'L4',
  CREATE_CLOSE_REQUEST: 'L3',
  OVERRIDE_BLOCKER: 'L5',
};

// Role level numeric values
const ROLE_LEVEL_VALUE: Record<RoleLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryBlockerResolutionService {
  private readonly logger = new Logger(InventoryBlockerResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: InventoryCloseNotificationsService,
    private readonly eventsService: InventoryPeriodEventsService,
  ) {}

  /**
   * Resolve a blocker for a period.
   * Validates RBAC and applies idempotent resolution.
   */
  async resolveBlocker(
    orgId: string,
    userId: string,
    userRole: RoleLevel,
    periodId: string,
    dto: ResolveBlockerDto,
  ): Promise<ResolveResult> {
    // 1. Validate period exists
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
      include: { branch: true },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    // 2. Validate RBAC
    const requiredLevel = ACTION_RBAC[dto.action];
    if (!requiredLevel) {
      throw new NotFoundException(`Unknown action: ${dto.action}`);
    }

    const userLevelValue = ROLE_LEVEL_VALUE[userRole] || 0;
    const requiredValue = ROLE_LEVEL_VALUE[requiredLevel];

    if (userLevelValue < requiredValue) {
      throw new ForbiddenException(
        `Action ${dto.action} requires ${requiredLevel} or higher. You have ${userRole}.`,
      );
    }

    // 3. Execute resolution based on action
    let result: ResolveResult;

    switch (dto.action) {
      case 'VOID_STOCKTAKE':
        result = await this.voidStocktake(orgId, userId, dto.entityId);
        break;
      case 'POST_STOCKTAKE':
        result = await this.postStocktake(orgId, userId, dto.entityId);
        break;
      case 'POST_RECEIPT':
        result = await this.postReceipt(orgId, userId, dto.entityId);
        break;
      case 'VOID_RECEIPT':
        result = await this.voidReceipt(orgId, userId, dto.entityId);
        break;
      case 'POST_WASTE':
        result = await this.postWaste(orgId, userId, dto.entityId);
        break;
      case 'VOID_WASTE':
        result = await this.voidWaste(orgId, userId, dto.entityId);
        break;
      case 'RETRY_GL_POSTING':
        result = await this.retryGLPosting(orgId, userId, dto.entityId);
        break;
      case 'CREATE_CLOSE_REQUEST':
        result = await this.createCloseRequest(orgId, userId, periodId);
        break;
      case 'OVERRIDE_BLOCKER':
        result = await this.overrideBlocker(orgId, userId, periodId, dto);
        break;
      default:
        throw new NotFoundException(`Unknown action: ${dto.action}`);
    }

    // 4. Log event (using OVERRIDE_USED as the closest event type for resolution actions)
    await this.eventsService.logEvent({
      orgId,
      branchId: period.branchId,
      periodId,
      type: 'OVERRIDE_USED', // Using existing event type for blocker resolution
      actorUserId: userId,
      metadataJson: {
        resolutionAction: dto.action,
        entityId: dto.entityId,
        notes: dto.notes,
        idempotent: result.idempotent,
        originalType: result.idempotent ? 'BLOCKER_RESOLUTION_SKIPPED' : 'BLOCKER_RESOLVED',
      },
    });

    // 5. Emit notification (if not idempotent)
    if (!result.idempotent) {
      await this.notificationsService.emitNotification(
        orgId,
        period.branchId,
        period.branch.name,
        'OVERRIDE_USED', // Using existing event type
        period.startDate,
        period.endDate,
        dto.action,
        this.getRoleName(userRole),
        { requestId: dto.entityId, reason: dto.notes },
      );
    }

    return result;
  }

  // ============================================
  // Resolution Actions
  // ============================================

  private async voidStocktake(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for VOID_STOCKTAKE');
    }

    const stocktake = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: entityId, orgId },
    });

    if (!stocktake) {
      throw new NotFoundException('Stocktake not found');
    }

    // Idempotency: already voided
    if (stocktake.voidedAt) {
      return {
        success: true,
        action: 'VOID_STOCKTAKE',
        entityId,
        message: 'Stocktake already voided',
        idempotent: true,
      };
    }

    // Void it
    await this.prisma.client.stocktakeSession.update({
      where: { id: entityId },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidedById: userId,
      },
    });

    return {
      success: true,
      action: 'VOID_STOCKTAKE',
      entityId,
      message: 'Stocktake voided successfully',
      idempotent: false,
    };
  }

  private async postStocktake(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for POST_STOCKTAKE');
    }

    const stocktake = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: entityId, orgId },
    });

    if (!stocktake) {
      throw new NotFoundException('Stocktake not found');
    }

    // Idempotency: already posted
    if (stocktake.postedAt) {
      return {
        success: true,
        action: 'POST_STOCKTAKE',
        entityId,
        message: 'Stocktake already posted',
        idempotent: true,
      };
    }

    // Post it
    await this.prisma.client.stocktakeSession.update({
      where: { id: entityId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
    });

    return {
      success: true,
      action: 'POST_STOCKTAKE',
      entityId,
      message: 'Stocktake posted successfully',
      idempotent: false,
    };
  }

  private async postReceipt(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for POST_RECEIPT');
    }

    const receipt = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: entityId, orgId },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    // Idempotency: already posted
    if (receipt.status === 'POSTED') {
      return {
        success: true,
        action: 'POST_RECEIPT',
        entityId,
        message: 'Receipt already posted',
        idempotent: true,
      };
    }

    // Post it
    await this.prisma.client.goodsReceiptV2.update({
      where: { id: entityId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
    });

    return {
      success: true,
      action: 'POST_RECEIPT',
      entityId,
      message: 'Receipt posted successfully',
      idempotent: false,
    };
  }

  private async voidReceipt(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for VOID_RECEIPT');
    }

    const receipt = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: entityId, orgId },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    // Idempotency: already voided
    if (receipt.status === 'VOID') {
      return {
        success: true,
        action: 'VOID_RECEIPT',
        entityId,
        message: 'Receipt already voided',
        idempotent: true,
      };
    }

    // Void it (receipts only have status field, no voidedAt/voidedById)
    await this.prisma.client.goodsReceiptV2.update({
      where: { id: entityId },
      data: {
        status: 'VOID',
      },
    });

    return {
      success: true,
      action: 'VOID_RECEIPT',
      entityId,
      message: 'Receipt voided successfully',
      idempotent: false,
    };
  }

  private async postWaste(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for POST_WASTE');
    }

    const waste = await this.prisma.client.inventoryWaste.findFirst({
      where: { id: entityId, orgId },
    });

    if (!waste) {
      throw new NotFoundException('Waste record not found');
    }

    // Idempotency: already posted
    if (waste.status === 'POSTED') {
      return {
        success: true,
        action: 'POST_WASTE',
        entityId,
        message: 'Waste already posted',
        idempotent: true,
      };
    }

    // Post it
    await this.prisma.client.inventoryWaste.update({
      where: { id: entityId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
    });

    return {
      success: true,
      action: 'POST_WASTE',
      entityId,
      message: 'Waste posted successfully',
      idempotent: false,
    };
  }

  private async voidWaste(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for VOID_WASTE');
    }

    const waste = await this.prisma.client.inventoryWaste.findFirst({
      where: { id: entityId, orgId },
    });

    if (!waste) {
      throw new NotFoundException('Waste record not found');
    }

    // Idempotency: already voided
    if (waste.status === 'VOID') {
      return {
        success: true,
        action: 'VOID_WASTE',
        entityId,
        message: 'Waste already voided',
        idempotent: true,
      };
    }

    // Void it (waste only has status field, no voidedAt/voidedById)
    await this.prisma.client.inventoryWaste.update({
      where: { id: entityId },
      data: {
        status: 'VOID',
      },
    });

    return {
      success: true,
      action: 'VOID_WASTE',
      entityId,
      message: 'Waste voided successfully',
      idempotent: false,
    };
  }

  private async retryGLPosting(
    orgId: string,
    userId: string,
    entityId?: string,
  ): Promise<ResolveResult> {
    if (!entityId) {
      throw new NotFoundException('entityId required for RETRY_GL_POSTING');
    }

    // Try depletions first
    const depletion = await this.prisma.client.orderInventoryDepletion.findFirst({
      where: { id: entityId, orgId },
    });

    if (depletion) {
      // Idempotency: if not FAILED, already resolved
      if (depletion.glPostingStatus !== 'FAILED') {
        return {
          success: true,
          action: 'RETRY_GL_POSTING',
          entityId,
          message: 'GL posting not in FAILED state',
          idempotent: true,
        };
      }

      // Mark for retry
      await this.prisma.client.orderInventoryDepletion.update({
        where: { id: entityId },
        data: { glPostingStatus: 'PENDING' },
      });

      return {
        success: true,
        action: 'RETRY_GL_POSTING',
        entityId,
        message: 'GL posting marked for retry',
        idempotent: false,
      };
    }

    // Try receipts
    const receipt = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: entityId, orgId },
    });

    if (receipt) {
      if (receipt.glPostingStatus !== 'FAILED') {
        return {
          success: true,
          action: 'RETRY_GL_POSTING',
          entityId,
          message: 'GL posting not in FAILED state',
          idempotent: true,
        };
      }

      await this.prisma.client.goodsReceiptV2.update({
        where: { id: entityId },
        data: { glPostingStatus: 'PENDING' },
      });

      return {
        success: true,
        action: 'RETRY_GL_POSTING',
        entityId,
        message: 'GL posting marked for retry',
        idempotent: false,
      };
    }

    throw new NotFoundException('Entity not found for GL retry');
  }

  private async createCloseRequest(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<ResolveResult> {
    // Get period to get branchId
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    // Check for existing request
    const existing = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: { orgId, periodId },
    });

    if (existing) {
      return {
        success: true,
        action: 'CREATE_CLOSE_REQUEST',
        entityId: existing.id,
        message: `Close request already exists in ${existing.status} status`,
        idempotent: true,
      };
    }

    // Create new request using connect syntax for relations
    const request = await this.prisma.client.inventoryPeriodCloseRequest.create({
      data: {
        org: { connect: { id: orgId } },
        branch: { connect: { id: period.branchId } },
        period: { connect: { id: periodId } },
        status: 'DRAFT',
        requestedBy: { connect: { id: userId } },
      },
    });

    return {
      success: true,
      action: 'CREATE_CLOSE_REQUEST',
      entityId: request.id,
      message: 'Close request created',
      idempotent: false,
    };
  }

  private async overrideBlocker(
    orgId: string,
    userId: string,
    periodId: string,
    dto: ResolveBlockerDto,
  ): Promise<ResolveResult> {
    // H9: Log override notification
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
      include: { branch: true },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    await this.notificationsService.emitNotification(
      orgId,
      period.branchId,
      period.branch.name,
      'OVERRIDE_USED' as InventoryPeriodEventType,
      period.startDate,
      period.endDate,
      dto.type,
      'Owner',
      { reason: dto.notes },
    );

    return {
      success: true,
      action: 'OVERRIDE_BLOCKER',
      entityId: periodId,
      message: `Blocker ${dto.type} overridden by L5`,
      idempotent: false,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private getRoleName(roleLevel: RoleLevel): string {
    const names: Record<RoleLevel, string> = {
      L1: 'Staff',
      L2: 'Team Member',
      L3: 'Supervisor',
      L4: 'Manager',
      L5: 'Owner',
    };
    return names[roleLevel] || roleLevel;
  }
}
