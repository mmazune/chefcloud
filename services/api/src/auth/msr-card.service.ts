import { Injectable, Logger, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SessionsService } from './sessions.service';
import { createHash } from 'crypto';

/**
 * M10: MsrCardService
 * 
 * Manages MSR card lifecycle:
 * - Assign cards to employees (hashes track data)
 * - Revoke cards
 * - Authenticate by card swipe
 * - Track card audit trail
 * 
 * Security:
 * - Never stores raw track data
 * - Uses SHA-256 hash of track data as cardToken
 * - Integrates with SessionsService for session invalidation on revocation
 * 
 * @example
 * ```typescript
 * // Assign card to employee
 * await msrCardService.assignCard({
 *   employeeId: 'emp_123',
 *   trackData: 'CLOUDBADGE:W001',
 *   assignedById: 'manager_456',
 * });
 * 
 * // Revoke card
 * await msrCardService.revokeCard('card_789', 'admin_012', 'Employee terminated');
 * 
 * // Authenticate by card swipe
 * const card = await msrCardService.authenticateByCard('CLOUDBADGE:W001');
 * // Returns employee, user, and context for session creation
 * ```
 */
@Injectable()
export class MsrCardService {
  private readonly logger = new Logger(MsrCardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Hash track data to create cardToken
   * Uses SHA-256 to ensure uniqueness and prevent raw data storage
   */
  private hashTrackData(trackData: string): string {
    return createHash('sha256').update(trackData).digest('hex');
  }

  /**
   * Assign MSR card to employee
   * Creates new MsrCard record with hashed token
   */
  async assignCard(params: {
    employeeId: string;
    trackData: string; // Raw track data (will be hashed)
    assignedById: string;
    metadata?: any;
  }) {
    const { employeeId, trackData, assignedById, metadata } = params;

    // Hash track data
    const cardToken = this.hashTrackData(trackData);

    // Check if employee exists
    const employee = await this.prisma.client.employee.findUnique({
      where: { id: employeeId },
      include: { user: true, msrCard: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    // Check if employee already has a card
    if (employee.msrCard) {
      throw new ConflictException(
        `Employee already has MSR card assigned. Revoke existing card first.`
      );
    }

    // Check if this cardToken is already assigned to another employee
    const existing = await this.prisma.client.msrCard.findUnique({
      where: { cardToken },
      include: { employee: true },
    });

    if (existing) {
      throw new ConflictException(
        `Card already assigned to employee ${existing.employee.employeeCode} (${existing.employee.firstName} ${existing.employee.lastName})`
      );
    }

    // Create MSR card assignment
    const msrCard = await this.prisma.client.msrCard.create({
      data: {
        orgId: employee.orgId,
        employeeId,
        cardToken,
        assignedById,
        metadata,
      },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `MSR card assigned to employee ${employee.employeeCode} (${employee.firstName} ${employee.lastName}) by ${msrCard.assignedBy.firstName} ${msrCard.assignedBy.lastName}`
    );

    return msrCard;
  }

  /**
   * Revoke MSR card
   * Marks card as revoked and invalidates all associated sessions
   */
  async revokeCard(cardId: string, revokedById: string, reason: string) {
    const card = await this.prisma.client.msrCard.findUnique({
      where: { id: cardId },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    if (!card) {
      throw new NotFoundException(`MSR card ${cardId} not found`);
    }

    if (card.status === 'REVOKED') {
      this.logger.warn(`MSR card ${cardId} already revoked`);
      return card;
    }

    // Update card status
    const updated = await this.prisma.client.msrCard.update({
      where: { id: cardId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById,
        revokedReason: reason,
      },
      include: {
        employee: {
          include: { user: true },
        },
        revokedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `MSR card revoked for employee ${card.employee.employeeCode} - Reason: ${reason}`
    );

    // Invalidate all sessions for this user
    if (card.employee.userId) {
      await this.sessionsService.revokeAllUserSessions(
        card.employee.userId,
        revokedById,
        `MSR card revoked: ${reason}`
      );
    }

    return updated;
  }

  /**
   * Suspend MSR card temporarily (e.g., for investigation)
   */
  async suspendCard(cardId: string, suspendedById: string, reason: string) {
    const card = await this.prisma.client.msrCard.findUnique({
      where: { id: cardId },
      include: { employee: true },
    });

    if (!card) {
      throw new NotFoundException(`MSR card ${cardId} not found`);
    }

    const updated = await this.prisma.client.msrCard.update({
      where: { id: cardId },
      data: {
        status: 'SUSPENDED',
        metadata: {
          ...(typeof card.metadata === 'object' ? card.metadata : {}),
          suspendedAt: new Date().toISOString(),
          suspendedBy: suspendedById,
          suspendedReason: reason,
        },
      },
      include: { employee: true },
    });

    this.logger.log(
      `MSR card suspended for employee ${card.employee.employeeCode} - Reason: ${reason}`
    );

    // Invalidate active sessions
    if (card.employee.userId) {
      await this.sessionsService.revokeAllUserSessions(
        card.employee.userId,
        suspendedById,
        `MSR card suspended: ${reason}`
      );
    }

    return updated;
  }

  /**
   * Reactivate suspended card
   */
  async reactivateCard(cardId: string, reactivatedById: string) {
    const card = await this.prisma.client.msrCard.findUnique({
      where: { id: cardId },
      include: { employee: true },
    });

    if (!card) {
      throw new NotFoundException(`MSR card ${cardId} not found`);
    }

    if (card.status === 'REVOKED') {
      throw new ConflictException('Cannot reactivate revoked card. Assign new card instead.');
    }

    const updated = await this.prisma.client.msrCard.update({
      where: { id: cardId },
      data: {
        status: 'ACTIVE',
        metadata: {
          ...(typeof card.metadata === 'object' ? card.metadata : {}),
          reactivatedAt: new Date().toISOString(),
          reactivatedBy: reactivatedById,
        },
      },
      include: { employee: true },
    });

    this.logger.log(`MSR card reactivated for employee ${card.employee.employeeCode}`);

    return updated;
  }

  /**
   * Authenticate by card swipe
   * Finds active card by hashed track data and returns employee/user context
   */
  async authenticateByCard(trackData: string) {
    const cardToken = this.hashTrackData(trackData);

    const card = await this.prisma.client.msrCard.findUnique({
      where: { cardToken },
      include: {
        employee: {
          include: {
            user: {
              include: {
                org: true,
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException('MSR card not found or not assigned');
    }

    if (card.status === 'REVOKED') {
      throw new UnauthorizedException('MSR card has been revoked');
    }

    if (card.status === 'SUSPENDED') {
      throw new UnauthorizedException('MSR card is suspended');
    }

    if (!card.employee.user) {
      throw new UnauthorizedException('Employee does not have a user account');
    }

    if (!card.employee.user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    if (card.employee.status !== 'ACTIVE') {
      throw new UnauthorizedException('Employee is not active');
    }

    this.logger.debug(
      `MSR authentication successful for employee ${card.employee.employeeCode}`
    );

    return {
      card,
      employee: card.employee,
      user: card.employee.user,
    };
  }

  /**
   * Get MSR card by employee ID
   */
  async getCardByEmployee(employeeId: string) {
    return this.prisma.client.msrCard.findUnique({
      where: { employeeId },
      include: {
        employee: {
          include: { user: true },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        revokedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * List all MSR cards for an org (with filters)
   */
  async listCards(orgId: string, filters?: {
    status?: 'ACTIVE' | 'REVOKED' | 'SUSPENDED';
    employeeCode?: string;
  }) {
    return this.prisma.client.msrCard.findMany({
      where: {
        orgId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.employeeCode && {
          employee: {
            employeeCode: filters.employeeCode,
          },
        }),
      },
      include: {
        employee: {
          include: { user: true },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
