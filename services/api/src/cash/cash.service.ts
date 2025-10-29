/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { PostingService } from '../accounting/posting.service';

@Injectable()
export class CashService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
  ) {}

  /**
   * Open a new till session
   * Enforces one open session per drawer/branch
   */
  async openTillSession(
    orgId: string,
    branchId: string,
    drawerId: string,
    openingFloat: number,
    userId: string,
    shiftId?: string,
  ): Promise<any> {
    // Check for existing open session on this drawer
    const existingOpen = await this.prisma.client.tillSession.findFirst({
      where: {
        branchId,
        drawerId,
        closedAt: null,
      },
    });

    if (existingOpen) {
      throw new BadRequestException(
        `Drawer ${drawerId} already has an open session (${existingOpen.id})`,
      );
    }

    const session = await this.prisma.client.tillSession.create({
      data: {
        orgId,
        branchId,
        drawerId,
        openedById: userId,
        openingFloat,
        shiftId,
      },
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return session;
  }

  /**
   * Close a till session with counted cash
   * Computes variance: closingCount - (openingFloat + netMovements + netSales)
   */
  async closeTillSession(
    tillSessionId: string,
    orgId: string,
    closingCount: number,
    userId: string,
  ): Promise<any> {
    const session = await this.prisma.client.tillSession.findFirst({
      where: { id: tillSessionId, orgId },
      include: {
        cashMovements: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Till session ${tillSessionId} not found`);
    }

    if (session.closedAt) {
      throw new BadRequestException('Till session already closed');
    }

    // Calculate net cash movements
    const netMovements = session.cashMovements.reduce(
      (sum: number, m: { type: string; amount: Prisma.Decimal }) => {
        const amount = parseFloat(m.amount.toString());
        switch (m.type) {
          case 'PAID_IN':
          case 'PICKUP': // Pickup adds cash to drawer
            return sum + amount;
          case 'PAID_OUT':
          case 'SAFE_DROP': // Safe drop removes cash from drawer
            return sum - amount;
          default:
            return sum;
        }
      },
      0,
    );

    // Get net sales for this session (orders closed during session period)
    // Note: This is a simplified approach. In production, you'd track orders to sessions more explicitly.
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId: session.branchId,
        status: 'CLOSED',
        updatedAt: {
          gte: session.openedAt,
          lte: new Date(),
        },
      },
      select: {
        total: true,
        discount: true,
      },
    });

    const netSales = orders.reduce(
      (sum: number, o: { total: Prisma.Decimal; discount: Prisma.Decimal | null }) => {
        return sum + parseFloat(o.total.toString()) - parseFloat((o.discount || 0).toString());
      },
      0,
    );

    const openingFloat = parseFloat(session.openingFloat.toString());
    const expectedCash = openingFloat + netMovements + netSales;
    const variance = closingCount - expectedCash;

    const updated = await this.prisma.client.tillSession.update({
      where: { id: tillSessionId },
      data: {
        closedById: userId,
        closedAt: new Date(),
        closingCount,
        variance,
      },
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        cashMovements: true,
      },
    });

    // Create audit event
    await this.prisma.client.auditEvent.create({
      data: {
        branchId: session.branchId,
        userId,
        action: 'TILL_CLOSE',
        resource: 'TillSession',
        resourceId: tillSessionId,
        metadata: {
          drawerId: session.drawerId,
          openingFloat,
          closingCount,
          variance,
          expectedCash,
          netMovements,
          netSales,
        } as any,
      },
    });

    return updated;
  }

  /**
   * Create a cash movement (PAID_IN, PAID_OUT, SAFE_DROP, PICKUP)
   * Role gating: L2+ for PAID_IN/PAID_OUT, L3+ for SAFE_DROP, L4+ for PICKUP
   */
  async createCashMovement(
    orgId: string,
    branchId: string,
    tillSessionId: string,
    type: 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP' | 'PICKUP',
    amount: number,
    reason: string | undefined,
    userId: string,
    userRole: string,
  ): Promise<any> {
    // Verify till session exists and is open
    const session = await this.prisma.client.tillSession.findFirst({
      where: { id: tillSessionId, orgId, branchId },
    });

    if (!session) {
      throw new NotFoundException(`Till session ${tillSessionId} not found`);
    }

    if (session.closedAt) {
      throw new BadRequestException('Cannot add movements to a closed till session');
    }

    // Role-based authorization
    const roleLevel = this.getRoleLevel(userRole);
    if (type === 'SAFE_DROP' && roleLevel < 3) {
      throw new ForbiddenException('SAFE_DROP requires L3+ (Supervisor)');
    }
    if (type === 'PICKUP' && roleLevel < 4) {
      throw new ForbiddenException('PICKUP requires L4+ (Manager)');
    }

    const movement = await this.prisma.client.cashMovement.create({
      data: {
        orgId,
        branchId,
        tillSessionId,
        type,
        amount,
        reason,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Create audit event
    await this.prisma.client.auditEvent.create({
      data: {
        branchId,
        userId,
        action: `CASH_MOVEMENT_${type}`,
        resource: 'CashMovement',
        resourceId: movement.id,
        metadata: {
          tillSessionId,
          amount,
          reason,
        } as any,
      },
    });

    // E40-s1: Post cash movement to GL (fire-and-forget, idempotent)
    this.postingService.postCashMovement(movement.id, userId).catch((err) => {
      this.prisma.client.auditEvent.create({
        data: {
          branchId,
          userId,
          action: 'cash_movement.gl_posting.failed',
          resource: 'CashMovement',
          resourceId: movement.id,
          metadata: {
            error: err.message,
          } as any,
        },
      });
    });

    return movement;
  }

  /**
   * Get current open till session for a drawer
   */
  async getCurrentTillSession(orgId: string, branchId: string, drawerId?: string): Promise<any> {
    const where: Prisma.TillSessionWhereInput = {
      orgId,
      branchId,
      closedAt: null,
    };

    if (drawerId) {
      where.drawerId = drawerId;
    }

    const session = await this.prisma.client.tillSession.findFirst({
      where,
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        cashMovements: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    return session;
  }

  /**
   * Get till sessions for reporting (with optional date range)
   */
  async getTillSessions(
    orgId: string,
    branchId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const where: Prisma.TillSessionWhereInput = {
      orgId,
      branchId,
    };

    if (startDate || endDate) {
      where.openedAt = {};
      if (startDate) where.openedAt.gte = startDate;
      if (endDate) where.openedAt.lte = endDate;
    }

    return this.prisma.client.tillSession.findMany({
      where,
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        cashMovements: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  /**
   * Helper to get numeric role level
   */
  private getRoleLevel(role: string): number {
    const match = role.match(/L(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
