import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma.service';
import { MtnSandboxAdapter } from './adapters/mtn-sandbox.adapter';
import { AirtelSandboxAdapter } from './adapters/airtel-sandbox.adapter';
import { PostingService } from '../accounting/posting.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            paymentIntent: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
            },
            payment: {
              create: jest.fn(),
            },
            webhookEvent: {
              create: jest.fn(),
              update: jest.fn(),
            },
            client: {
              eventBooking: {
                findFirst: jest.fn(),
                update: jest.fn(),
              },
              prepaidCredit: {
                create: jest.fn(),
              },
              $transaction: jest.fn((callback) => callback({})),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PAY_MTN_ENABLED') return 'false';
              if (key === 'PAY_AIRTEL_ENABLED') return 'false';
              if (key === 'PAYMENTS_FORCE_FAIL') return '';
              return undefined;
            }),
          },
        },
        {
          provide: PostingService,
          useValue: {
            postRefund: jest.fn().mockResolvedValue(undefined),
          },
        },
        MtnSandboxAdapter,
        AirtelSandboxAdapter,
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createIntent', () => {
    it('should create a payment intent successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        branchId: 'branch-1',
        total: 50000,
      };

      const mockIntent = {
        id: 'intent-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        orderId: 'order-1',
        provider: 'MTN',
        amount: 50000,
        currency: 'UGX',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.paymentIntent, 'create').mockResolvedValue(mockIntent as any);
      jest.spyOn(prisma.paymentIntent, 'update').mockResolvedValue({
        ...mockIntent,
        providerRef: 'MTN-123',
      } as any);

      const result = await service.createIntent(
        { orderId: 'order-1', provider: 'MTN', amount: 50000 },
        'org-1',
        'branch-1',
      );

      expect(result).toHaveProperty('intentId');
      expect(result).toHaveProperty('nextAction');
      expect(prisma.paymentIntent.create).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);

      await expect(
        service.createIntent(
          { orderId: 'order-999', provider: 'MTN', amount: 50000 },
          'org-1',
          'branch-1',
        ),
      ).rejects.toThrow('Order order-999 not found');
    });
  });

  describe('cancelIntent', () => {
    it('should cancel a pending intent', async () => {
      const mockIntent = {
        id: 'intent-1',
        status: 'PENDING',
      };

      jest.spyOn(prisma.paymentIntent, 'findUnique').mockResolvedValue(mockIntent as any);
      jest.spyOn(prisma.paymentIntent, 'update').mockResolvedValue({
        ...mockIntent,
        status: 'CANCELLED',
      } as any);

      const result = await service.cancelIntent('intent-1');

      expect(result.success).toBe(true);
      expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
        where: { id: 'intent-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw error if intent already succeeded', async () => {
      const mockIntent = {
        id: 'intent-1',
        status: 'SUCCEEDED',
      };

      jest.spyOn(prisma.paymentIntent, 'findUnique').mockResolvedValue(mockIntent as any);

      await expect(service.cancelIntent('intent-1')).rejects.toThrow(
        'Cannot cancel intent with status SUCCEEDED',
      );
    });
  });

  describe('handleWebhook', () => {
    it('should process MTN webhook successfully', async () => {
      const mockIntent = {
        id: 'intent-1',
        orderId: 'order-1',
        amount: 50000,
        provider: 'MTN',
        providerRef: 'MTN-123',
        metadata: {},
      };

      const mockWebhookEvent = {
        id: 'webhook-1',
        provider: 'MTN',
        eventType: 'payment.success',
        raw: {},
        verified: false,
        receivedAt: new Date(),
      };

      jest.spyOn(prisma.webhookEvent, 'create').mockResolvedValue(mockWebhookEvent as any);
      jest.spyOn(prisma.webhookEvent, 'update').mockResolvedValue({
        ...mockWebhookEvent,
        verified: true,
      } as any);
      jest.spyOn(prisma.paymentIntent, 'findUnique').mockResolvedValue(mockIntent as any);
      jest.spyOn(prisma.paymentIntent, 'update').mockResolvedValue({
        ...mockIntent,
        status: 'SUCCEEDED',
      } as any);
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as any);
      // Mock event booking check (E42-s1) - returns null (no booking associated)
      jest.spyOn(prisma.client.eventBooking, 'findFirst').mockResolvedValue(null);

      const result = await service.handleWebhook('MTN', {
        intentId: 'intent-1',
        status: 'success',
      });

      expect(result.success).toBe(true);
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('reconcileExpiredIntents', () => {
    it('should mark expired intents as FAILED', async () => {
      const expiredIntent = {
        id: 'intent-1',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
        metadata: {},
      };

      jest.spyOn(prisma.paymentIntent, 'findMany').mockResolvedValue([expiredIntent] as any);
      jest.spyOn(prisma.paymentIntent, 'update').mockResolvedValue({
        ...expiredIntent,
        status: 'FAILED',
      } as any);

      const result = await service.reconcileExpiredIntents();

      expect(result.reconciledCount).toBe(1);
      expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
        where: { id: 'intent-1' },
        data: {
          status: 'FAILED',
          metadata: { reason: 'expired' },
        },
      });
    });
  });
});
