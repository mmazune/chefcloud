import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MtnSandboxAdapter } from './adapters/mtn-sandbox.adapter';
import { AirtelSandboxAdapter } from './adapters/airtel-sandbox.adapter';
import { IPaymentAdapter } from './interfaces/payment-adapter.interface';
import { CreateIntentDto, RefundDto } from './dto/create-intent.dto';
import { AuthHelpers } from '../auth/auth.helpers';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly adapters: Map<string, IPaymentAdapter>;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private mtnAdapter: MtnSandboxAdapter,
    private airtelAdapter: AirtelSandboxAdapter,
  ) {
    this.adapters = new Map();
    
    // Register adapters based on enabled flags
    const mtnEnabled = this.configService.get<string>('PAY_MTN_ENABLED') === 'true';
    const airtelEnabled = this.configService.get<string>('PAY_AIRTEL_ENABLED') === 'true';

    if (mtnEnabled) {
      this.adapters.set('MTN', this.mtnAdapter);
      this.logger.log('MTN payment adapter enabled');
    }
    if (airtelEnabled) {
      this.adapters.set('AIRTEL', this.airtelAdapter);
      this.logger.log('Airtel payment adapter enabled');
    }

    // Always register for sandbox/simulation mode
    if (!mtnEnabled && !airtelEnabled) {
      this.adapters.set('MTN', this.mtnAdapter);
      this.adapters.set('AIRTEL', this.airtelAdapter);
      this.logger.log('Payment adapters running in SANDBOX mode');
    }
  }

  async createIntent(dto: CreateIntentDto, orgId: string, branchId: string) {
    const { orderId, provider, amount } = dto;

    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.branchId !== branchId) {
      throw new BadRequestException('Order does not belong to this branch');
    }

    // Get adapter
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Provider ${provider} not supported or not enabled`);
    }

    // Create PaymentIntent record
    const intent = await this.prisma.paymentIntent.create({
      data: {
        orgId,
        branchId,
        orderId,
        provider,
        amount,
        currency: 'UGX',
        status: 'PENDING',
      },
    });

    this.logger.log(`Created PaymentIntent ${intent.id} for order ${orderId}`);

    // Call adapter to initiate payment
    try {
      const result = await adapter.createIntent({
        intentId: intent.id,
        amount,
        currency: 'UGX',
        metadata: { orderId, branchId },
      });

      // Update intent with provider reference
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          providerRef: result.providerRef,
          metadata: result.metadata as any,
        },
      });

      return {
        intentId: intent.id,
        nextAction: result.nextAction,
        providerRef: result.providerRef,
      };
    } catch (error) {
      // Mark intent as failed
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'FAILED', metadata: { error: (error as Error).message } as any },
      });
      throw error;
    }
  }

  async cancelIntent(intentId: string) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
    });

    if (!intent) {
      throw new NotFoundException(`PaymentIntent ${intentId} not found`);
    }

    if (intent.status !== 'PENDING' && intent.status !== 'REQUIRES_ACTION') {
      throw new BadRequestException(
        `Cannot cancel intent with status ${intent.status}`,
      );
    }

    await this.prisma.paymentIntent.update({
      where: { id: intentId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Cancelled PaymentIntent ${intentId}`);

    return { success: true, intentId };
  }

  async handleWebhook(provider: string, payload: any, signature?: string) {
    const adapter = this.adapters.get(provider.toUpperCase());
    if (!adapter) {
      throw new BadRequestException(`Provider ${provider} not supported`);
    }

    // Store raw webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: provider.toUpperCase(),
        eventType: payload.type || payload.event_type || 'payment.status',
        raw: payload as any,
        verified: false,
      },
    });

    this.logger.log(`Received webhook ${webhookEvent.id} from ${provider}`);

    try {
      // Process webhook through adapter
      const result = await adapter.handleWebhook(payload, signature);

      // Mark webhook as verified
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { verified: true },
      });

      // Update PaymentIntent
      const intent = await this.prisma.paymentIntent.findUnique({
        where: { id: result.intentId },
      });

      if (!intent) {
        this.logger.warn(`Intent ${result.intentId} not found for webhook ${webhookEvent.id}`);
        return { success: false, reason: 'intent_not_found' };
      }

      await this.prisma.paymentIntent.update({
        where: { id: result.intentId },
        data: {
          status: result.status,
          providerRef: result.providerRef || intent.providerRef,
          metadata: {
            ...(typeof intent.metadata === 'object' && intent.metadata !== null ? intent.metadata : {}),
            ...(typeof result.metadata === 'object' && result.metadata !== null ? result.metadata : {})
          },
        },
      });

      // If succeeded, create Payment record
      if (result.status === 'SUCCEEDED') {
        await this.prisma.payment.create({
          data: {
            orderId: intent.orderId,
            amount: intent.amount,
            method: 'MOMO',
            status: 'completed',
            transactionId: result.providerRef || intent.providerRef,
            metadata: {
              provider: intent.provider,
              intentId: intent.id,
              webhookEventId: webhookEvent.id,
            } as any,
          },
        });

        this.logger.log(`Payment recorded for intent ${intent.id}`);
      }

      return { success: true, intentId: result.intentId, status: result.status };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${(error as Error).message}`, (error as Error).stack);
      return { success: false, reason: (error as Error).message };
    }
  }

  async reconcileExpiredIntents() {
    const expiryThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

    const expiredIntents = await this.prisma.paymentIntent.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: expiryThreshold },
      },
    });

    this.logger.log(`Found ${expiredIntents.length} expired payment intents`);

    for (const intent of expiredIntents) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(typeof intent.metadata === 'object' && intent.metadata !== null ? intent.metadata : {}),
            reason: 'expired'
          },
        },
      });
    }

    return { reconciledCount: expiredIntents.length };
  }

  async processRefund(dto: RefundDto, userId: string, branchId: string): Promise<any> {
    const { orderId, amount, reason, managerPin } = dto;

    // Get threshold from config
    const threshold = parseInt(
      this.configService.get<string>('REFUND_APPROVAL_THRESHOLD') || '20000',
      10
    );

    // Fetch order with payments
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.branchId !== branchId) {
      throw new BadRequestException('Order does not belong to this branch');
    }

    // Check if amount exceeds threshold
    if (amount >= threshold) {
      if (!managerPin) {
        throw new UnauthorizedException('Manager PIN required for refunds >= threshold');
      }

      // Verify manager PIN (L3+)
      const manager = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!manager || !manager.pinHash) {
        throw new UnauthorizedException('Manager PIN not set');
      }

      const pinValid = await AuthHelpers.verifyPin(manager.pinHash, managerPin);
      if (!pinValid) {
        throw new UnauthorizedException('Invalid manager PIN');
      }

      // Check role level (L3+ required)
      const roleLevel = parseInt(manager.roleLevel.replace('L', ''), 10);
      if (roleLevel < 3) {
        throw new ForbiddenException('Requires L3+ role for refunds >= threshold');
      }
    }

    // Detect provider from last payment
    const lastPayment = order.payments[order.payments.length - 1];
    if (!lastPayment) {
      throw new BadRequestException('No payment found for this order');
    }

    let provider = 'MANUAL';
    let refundStatus = 'PENDING';

    if (lastPayment.method === 'MOMO') {
      // Extract provider from payment metadata
      const metadata = lastPayment.metadata as { provider?: string } | null;
      provider = metadata?.provider?.toUpperCase() || 'MTN';

      // Call MOMO adapter for refund
      const adapter = this.adapters.get(provider);
      if (adapter) {
        try {
          // Simulate refund success (real implementation would call adapter.refund())
          this.logger.log(`Refund via ${provider} adapter: ${amount} UGX for order ${orderId}`);
          refundStatus = 'COMPLETED';
        } catch (error) {
          this.logger.error(`MOMO refund failed: ${(error as Error).message}`);
          refundStatus = 'FAILED';
        }
      }
    } else {
      // CASH/CARD refunds are manual
      refundStatus = 'COMPLETED';
    }

    // Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        paymentId: lastPayment.id,
        provider,
        amount,
        reason,
        status: refundStatus,
        createdById: userId,
        approvedById: amount >= threshold ? userId : null,
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        branchId,
        userId,
        action: 'REFUND',
        resource: 'payments',
        resourceId: refund.id,
        metadata: {
          orderId,
          amount,
          reason,
          provider,
          threshold,
          requiresApproval: amount >= threshold,
        },
      },
    });

    this.logger.log(`Refund ${refund.id} created for order ${orderId}: ${amount} UGX`);

    return refund;
  }
}
