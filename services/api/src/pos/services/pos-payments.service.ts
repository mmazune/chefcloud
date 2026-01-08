/**
 * M13.4 / M13.5: POS Payments Service
 *
 * Handles payment lifecycle: create → authorize → capture → void/refund
 * with idempotency, audit trail, and org/branch scoping.
 * 
 * M13.5 additions:
 * - Split/Partial Payments (multiple payments per order)
 * - Tips (tipCents field, NOT counted in dueCents)
 * - Order Payment Status (UNPAID|PARTIALLY_PAID|PAID|REFUNDED)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { FakeCardProvider } from '../providers/fake-card.provider';

export interface CreatePaymentDto {
  method: 'CASH' | 'CARD' | 'MOMO' | 'OTHER';
  amountCents: number;
  tipCents?: number; // M13.5: Tip amount (NOT counted in dueCents)
  idempotencyKey: string;
  provider?: 'INTERNAL' | 'FAKE_CARD';
  cardToken?: string;
  autoCaptureIfCash?: boolean; // Default true for CASH
}

export interface RefundPaymentDto {
  amountCents: number;
  reason: string;
}

// M13.5: Payment summary for an order
export interface PaymentSummary {
  orderId: string;
  orderTotalCents: number;
  paidCents: number; // SUM(capturedCents - refundedCents) for CAPTURED payments
  tipsCents: number; // SUM(tipCents) for CAPTURED payments
  dueCents: number; // max(0, orderTotalCents - paidCents)
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  payments: {
    id: string;
    method: string;
    amountCents: number;
    capturedCents: number;
    refundedCents: number;
    tipCents: number;
    posStatus: string;
  }[];
}

@Injectable()
export class PosPaymentsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private fakeCardProvider: FakeCardProvider,
  ) {}

  /**
   * Create a payment for an order
   * - CASH: Auto-capture if autoCaptureIfCash is true (default)
   * - CARD: Authorize only, requires separate capture
   * 
   * M13.5: Supports partial payments (amountCents <= dueCents)
   * M13.5: Supports tips (tipCents, NOT counted in dueCents)
   */
  async createPayment(
    orderId: string,
    dto: CreatePaymentDto,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    const tipCents = dto.tipCents || 0;

    // M13.5: Validate tipCents (non-negative, max 500% of amountCents)
    if (tipCents < 0) {
      throw new BadRequestException({
        code: 'INVALID_TIP',
        message: 'Tip cannot be negative',
      });
    }
    if (tipCents > dto.amountCents * 5) {
      throw new BadRequestException({
        code: 'TIP_TOO_HIGH',
        message: 'Tip cannot exceed 500% of payment amount',
      });
    }

    // Validate order belongs to org/branch
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
      include: {
        payments: {
          where: {
            posStatus: { in: ['CAPTURED', 'AUTHORIZED', 'PENDING'] },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found or access denied',
      });
    }

    // Validate order is payable (SENT, READY, SERVED, or IN_KITCHEN)
    const payableStates = ['SENT', 'READY', 'SERVED', 'IN_KITCHEN', 'NEW'];
    if (!payableStates.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_PAYABLE',
        message: `Order in ${order.status} status cannot accept payments`,
      });
    }

    // M13.5: Calculate dueCents = max(0, orderTotalCents - paidCents)
    const orderTotalCents = Math.round(Number(order.total) * 100);
    const paidCents = order.payments.reduce((sum, p) => {
      if (p.posStatus === 'CAPTURED') {
        return sum + p.capturedCents - p.refundedCents;
      }
      return sum;
    }, 0);
    const dueCents = Math.max(0, orderTotalCents - paidCents);

    // M13.5: Validate amount against dueCents (prevent overpayment)
    if (dto.amountCents > dueCents) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `Payment amount ${dto.amountCents} exceeds due amount ${dueCents}`,
      });
    }

    if (dto.amountCents <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Payment amount must be positive',
      });
    }

    // Idempotency check
    const existing = await this.prisma.client.payment.findFirst({
      where: {
        orgId,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (existing) {
      return existing; // Return existing payment (idempotent)
    }

    // Determine provider and initial status
    const provider = dto.provider || (dto.method === 'CARD' ? 'FAKE_CARD' : 'INTERNAL');
    let status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' = 'PENDING';
    let providerRef: string | null = null;

    // Handle CARD authorization
    if (dto.method === 'CARD' && provider === 'FAKE_CARD') {
      const token = dto.cardToken || 'test-token-success';
      const orderMetadata = order.metadata as { currency?: string } | null;
      const authResult = await this.fakeCardProvider.authorize(
        dto.amountCents,
        token,
        orderMetadata?.currency || 'USD',
      );

      if (!authResult.success) {
        // Create failed payment record
        const failedPayment = await this.prisma.client.payment.create({
          data: {
            orgId,
            branchId,
            orderId,
            method: dto.method,
            amountCents: dto.amountCents,
            amount: dto.amountCents / 100,
            currency: 'USD',
            posStatus: 'FAILED',
            provider: 'FAKE_CARD',
            idempotencyKey: dto.idempotencyKey,
            createdById: userId,
            metadata: {
              errorCode: authResult.errorCode,
              errorMessage: authResult.errorMessage,
            },
          },
        });

        await this.createPaymentEvent(orgId, failedPayment.id, 'FAILED', userId, {
          errorCode: authResult.errorCode,
        });

        throw new BadRequestException({
          code: authResult.errorCode,
          message: authResult.errorMessage,
        });
      }

      status = 'AUTHORIZED';
      providerRef = authResult.authId;
    }

    // Handle CASH auto-capture
    const autoCaptureIfCash = dto.autoCaptureIfCash !== false; // Default true
    if (dto.method === 'CASH' && autoCaptureIfCash) {
      status = 'CAPTURED';
    }

    // Create payment
    const payment = await this.prisma.client.payment.create({
      data: {
        orgId,
        branchId,
        orderId,
        method: dto.method,
        amountCents: dto.amountCents,
        capturedCents: status === 'CAPTURED' ? dto.amountCents : 0,
        tipCents, // M13.5: Include tip
        amount: dto.amountCents / 100,
        currency: 'USD',
        posStatus: status,
        provider: provider as any,
        providerRef,
        idempotencyKey: dto.idempotencyKey,
        createdById: userId,
        status: status === 'CAPTURED' ? 'completed' : 'pending', // Legacy field
      },
    });

    // M13.5: Update order paymentStatus if payment is captured
    if (status === 'CAPTURED') {
      await this.updateOrderPaymentStatus(orderId, orgId, branchId);
    }

    // Create audit events
    await this.createPaymentEvent(orgId, payment.id, 'CREATED', userId, {
      method: dto.method,
      amountCents: dto.amountCents,
      tipCents,
    });

    if (status === 'AUTHORIZED') {
      await this.createPaymentEvent(orgId, payment.id, 'AUTHORIZED', userId, {
        providerRef,
      });
    }

    if (status === 'CAPTURED') {
      await this.createPaymentEvent(orgId, payment.id, 'CAPTURED', userId, {
        capturedCents: dto.amountCents,
      });
    }

    return payment;
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(
    paymentId: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    const payment = await this.prisma.client.payment.findFirst({
      where: {
        id: paymentId,
        orgId,
        branchId,
      },
    });

    if (!payment) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found or access denied',
      });
    }

    // Idempotent: already captured
    if (payment.posStatus === 'CAPTURED') {
      return payment;
    }

    if (payment.posStatus !== 'AUTHORIZED') {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_STATUS',
        message: `Cannot capture payment in ${payment.posStatus} status`,
      });
    }

    // Call provider if card
    if (payment.provider === 'FAKE_CARD' && payment.providerRef) {
      const captureResult = await this.fakeCardProvider.capture(
        payment.providerRef,
        payment.amountCents,
      );

      if (!captureResult.success) {
        throw new BadRequestException({
          code: captureResult.errorCode,
          message: captureResult.errorMessage,
        });
      }
    }

    // Update payment
    const updated = await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        posStatus: 'CAPTURED',
        capturedCents: payment.amountCents,
        status: 'completed', // Legacy
      },
    });

    // M13.5: Update order paymentStatus
    await this.updateOrderPaymentStatus(payment.orderId, orgId, branchId);

    await this.createPaymentEvent(orgId, paymentId, 'CAPTURED', userId, {
      capturedCents: payment.amountCents,
    });

    return updated;
  }

  /**
   * Void a pending/authorized payment (L4+ only)
   */
  async voidPayment(
    paymentId: string,
    reason: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    if (!reason || reason.length < 10) {
      throw new BadRequestException({
        code: 'VOID_REASON_REQUIRED',
        message: 'Void reason must be at least 10 characters',
      });
    }

    const payment = await this.prisma.client.payment.findFirst({
      where: {
        id: paymentId,
        orgId,
        branchId,
      },
    });

    if (!payment) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found or access denied',
      });
    }

    // Idempotent: already voided
    if (payment.posStatus === 'VOIDED') {
      return payment;
    }

    if (payment.posStatus !== 'PENDING' && payment.posStatus !== 'AUTHORIZED') {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_STATUS',
        message: `Cannot void payment in ${payment.posStatus} status. Only PENDING or AUTHORIZED payments can be voided.`,
      });
    }

    // Call provider if card
    if (payment.provider === 'FAKE_CARD' && payment.providerRef) {
      const voidResult = await this.fakeCardProvider.void(payment.providerRef);
      if (!voidResult.success) {
        throw new BadRequestException({
          code: voidResult.errorCode,
          message: voidResult.errorMessage,
        });
      }
    }

    const updated = await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        posStatus: 'VOIDED',
        status: 'failed', // Legacy
        metadata: {
          ...(payment.metadata as object || {}),
          voidReason: reason,
          voidedAt: new Date().toISOString(),
          voidedById: userId,
        },
      },
    });

    await this.createPaymentEvent(orgId, paymentId, 'VOIDED', userId, {
      reason,
    });

    return updated;
  }

  /**
   * Refund a captured payment (L4+ only)
   */
  async refundPayment(
    paymentId: string,
    dto: RefundPaymentDto,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    if (!dto.reason || dto.reason.length < 10) {
      throw new BadRequestException({
        code: 'REFUND_REASON_REQUIRED',
        message: 'Refund reason must be at least 10 characters',
      });
    }

    const payment = await this.prisma.client.payment.findFirst({
      where: {
        id: paymentId,
        orgId,
        branchId,
      },
    });

    if (!payment) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found or access denied',
      });
    }

    if (payment.posStatus !== 'CAPTURED') {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_STATUS',
        message: `Cannot refund payment in ${payment.posStatus} status. Only CAPTURED payments can be refunded.`,
      });
    }

    // Validate refund amount
    const remaining = payment.capturedCents - payment.refundedCents;
    if (dto.amountCents > remaining) {
      throw new BadRequestException({
        code: 'REFUND_EXCEEDS_REMAINING',
        message: `Refund amount ${dto.amountCents} exceeds remaining ${remaining}`,
      });
    }

    // Call provider if card
    if (payment.provider === 'FAKE_CARD' && payment.providerRef) {
      const refundResult = await this.fakeCardProvider.refund(
        payment.providerRef,
        dto.amountCents,
      );
      if (!refundResult.success) {
        throw new BadRequestException({
          code: refundResult.errorCode,
          message: refundResult.errorMessage,
        });
      }
    }

    const newRefundedCents = payment.refundedCents + dto.amountCents;
    const newStatus = newRefundedCents >= payment.capturedCents ? 'REFUNDED' : 'CAPTURED';

    const updated = await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        refundedCents: newRefundedCents,
        posStatus: newStatus as any,
        status: newStatus === 'REFUNDED' ? 'refunded' : 'completed', // Legacy
      },
    });

    // M13.5: Update order paymentStatus
    await this.updateOrderPaymentStatus(payment.orderId, orgId, branchId);

    await this.createPaymentEvent(orgId, paymentId, 'REFUNDED', userId, {
      amountCents: dto.amountCents,
      reason: dto.reason,
      totalRefundedCents: newRefundedCents,
    });

    return updated;
  }

  /**
   * Get payment by ID
   */
  async getPayment(
    paymentId: string,
    orgId: string,
    branchId: string,
  ): Promise<any> {
    const payment = await this.prisma.client.payment.findFirst({
      where: {
        id: paymentId,
        orgId,
        branchId,
      },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found or access denied',
      });
    }

    return payment;
  }

  /**
   * Get payments for an order
   */
  async getOrderPayments(
    orderId: string,
    orgId: string,
    branchId: string,
  ): Promise<any[]> {
    return this.prisma.client.payment.findMany({
      where: {
        orderId,
        orgId,
        branchId,
      },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Check if order is fully paid
   */
  async isOrderFullyPaid(
    orderId: string,
    orgId: string,
    branchId: string,
  ): Promise<{ paid: boolean; totalCaptured: number; orderTotal: number }> {
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
    });

    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    const payments = await this.prisma.client.payment.findMany({
      where: {
        orderId,
        orgId,
        branchId,
        posStatus: 'CAPTURED',
      },
    });

    const totalCaptured = payments.reduce((sum, p) => sum + p.capturedCents, 0);
    const orderTotal = Math.round(Number(order.total) * 100);

    return {
      paid: totalCaptured >= orderTotal,
      totalCaptured,
      orderTotal,
    };
  }

  /**
   * Create payment event (audit trail)
   */
  private async createPaymentEvent(
    orgId: string,
    paymentId: string,
    type: string,
    userId: string,
    metadata: any = {},
  ): Promise<void> {
    await this.prisma.client.posPaymentEvent.create({
      data: {
        orgId,
        paymentId,
        type,
        createdById: userId,
        metadata,
      },
    });
  }

  /**
   * M13.5: Get payment summary for an order
   */
  async getPaymentSummary(
    orderId: string,
    orgId: string,
    branchId: string,
  ): Promise<PaymentSummary> {
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
      include: {
        payments: true,
      },
    });

    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    const orderTotalCents = Math.round(Number(order.total) * 100);
    
    // Calculate paidCents from CAPTURED payments only
    const capturedPayments = order.payments.filter(p => p.posStatus === 'CAPTURED');
    const paidCents = capturedPayments.reduce(
      (sum, p) => sum + p.capturedCents - p.refundedCents, 
      0
    );
    const tipsCents = capturedPayments.reduce((sum, p) => sum + p.tipCents, 0);
    const dueCents = Math.max(0, orderTotalCents - paidCents);

    // Determine paymentStatus
    let paymentStatus: PaymentSummary['paymentStatus'] = 'UNPAID';
    if (paidCents <= 0 && capturedPayments.some(p => p.refundedCents > 0)) {
      paymentStatus = 'REFUNDED';
    } else if (paidCents >= orderTotalCents) {
      paymentStatus = 'PAID';
    } else if (paidCents > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return {
      orderId,
      orderTotalCents,
      paidCents,
      tipsCents,
      dueCents,
      paymentStatus,
      payments: order.payments.map(p => ({
        id: p.id,
        method: p.method,
        amountCents: p.amountCents,
        capturedCents: p.capturedCents,
        refundedCents: p.refundedCents,
        tipCents: p.tipCents,
        posStatus: p.posStatus,
      })),
    };
  }

  /**
   * M13.5: Update order's paymentStatus based on current payments
   */
  private async updateOrderPaymentStatus(
    orderId: string,
    orgId: string,
    branchId: string,
  ): Promise<void> {
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
      include: {
        payments: {
          where: {
            posStatus: 'CAPTURED',
          },
        },
      },
    });

    if (!order) return;

    const orderTotalCents = Math.round(Number(order.total) * 100);
    const paidCents = order.payments.reduce(
      (sum, p) => sum + p.capturedCents - p.refundedCents,
      0,
    );

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' = 'UNPAID';

    // Check if all payments are fully refunded
    const allRefunded = order.payments.length > 0 && 
      order.payments.every(p => p.refundedCents >= p.capturedCents);

    if (allRefunded) {
      paymentStatus = 'REFUNDED';
    } else if (paidCents >= orderTotalCents) {
      paymentStatus = 'PAID';
    } else if (paidCents > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    await this.prisma.client.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }
}
