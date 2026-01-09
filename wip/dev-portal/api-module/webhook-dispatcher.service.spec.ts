import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;
  let prismaService: PrismaService;

  const mockPrisma = {
    webhookSubscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    webhookDelivery: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDispatcherService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WebhookDispatcherService>(WebhookDispatcherService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('enqueueEvent', () => {
    it('should create delivery records for matching subscriptions', async () => {
      const event = {
        type: 'order.created',
        orgId: 'org-123',
        payload: { orderId: 'order-456', total: 100 },
      };

      const mockSubscriptions = [
        {
          id: 'sub-1',
          orgId: 'org-123',
          url: 'https://example.com/webhook',
          eventTypes: ['order.created', 'order.completed'],
          secret: 'whsec_test123',
          status: 'ACTIVE',
        },
        {
          id: 'sub-2',
          orgId: 'org-123',
          url: 'https://example2.com/webhook',
          eventTypes: ['order.created'],
          secret: 'whsec_test456',
          status: 'ACTIVE',
        },
      ];

      mockPrisma.webhookSubscription.findMany.mockResolvedValue(mockSubscriptions);
      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: 'delivery-1',
        status: 'PENDING',
      });

      // Mock deliverWebhook to prevent actual HTTP calls
      jest.spyOn(service, 'deliverWebhook').mockResolvedValue(undefined);

      const count = await service.enqueueEvent(event);

      expect(count).toBe(2);
      expect(mockPrisma.webhookSubscription.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-123',
          status: 'ACTIVE',
          eventTypes: {
            has: 'order.created',
          },
        },
      });
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no matching subscriptions found', async () => {
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([]);

      const event = {
        type: 'payment.failed',
        orgId: 'org-123',
        payload: {},
      };

      const count = await service.enqueueEvent(event);

      expect(count).toBe(0);
    });
  });

  describe('computeSignature', () => {
    it('should generate consistent HMAC signatures', () => {
      const secret = 'whsec_test123';
      const timestamp = 1637000000;
      const body = JSON.stringify({ test: 'data' });

      // Access private method via reflection for testing
      const signature1 = (service as any).computeSignature(secret, timestamp, body);
      const signature2 = (service as any).computeSignature(secret, timestamp, body);

      expect(signature1).toBe(signature2);
      expect(signature1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('should generate different signatures for different secrets', () => {
      const timestamp = 1637000000;
      const body = JSON.stringify({ test: 'data' });

      const sig1 = (service as any).computeSignature('secret1', timestamp, body);
      const sig2 = (service as any).computeSignature('secret2', timestamp, body);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different timestamps', () => {
      const secret = 'whsec_test123';
      const body = JSON.stringify({ test: 'data' });

      const sig1 = (service as any).computeSignature(secret, 1000, body);
      const sig2 = (service as any).computeSignature(secret, 2000, body);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('listDeliveries', () => {
    it('should list deliveries with filters', async () => {
      const mockDeliveries = [
        {
          id: 'delivery-1',
          subscriptionId: 'sub-1',
          eventType: 'order.created',
          status: 'SUCCESS',
          subscription: {
            id: 'sub-1',
            url: 'https://example.com/webhook',
          },
        },
      ];

      mockPrisma.webhookDelivery.findMany.mockResolvedValue(mockDeliveries);

      const result = await service.listDeliveries({
        orgId: 'org-123',
        status: 'SUCCESS',
        limit: 50,
      });

      expect(result).toEqual(mockDeliveries);
      expect(mockPrisma.webhookDelivery.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'SUCCESS',
          subscription: {
            orgId: 'org-123',
          },
        }),
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          subscription: {
            select: {
              id: true,
              url: true,
              eventTypes: true,
              status: true,
            },
          },
        },
      });
    });
  });

  describe('getSubscriptionMetrics', () => {
    it('should calculate subscription metrics', async () => {
      const mockSubscription = {
        id: 'sub-123',
        orgId: 'org-123',
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webhookDelivery.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // successful
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(5); // pending

      mockPrisma.webhookDelivery.aggregate.mockResolvedValue({
        _avg: {
          latencyMs: 250,
        },
      });

      const result = await service.getSubscriptionMetrics('sub-123', 'org-123');

      expect(result).toEqual({
        subscriptionId: 'sub-123',
        total: 100,
        successful: 85,
        failed: 10,
        pending: 5,
        successRate: 85,
        avgLatencyMs: 250,
      });
    });

    it('should handle 0 total deliveries', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        orgId: 'org-123',
      });

      mockPrisma.webhookDelivery.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // successful
        .mockResolvedValueOnce(0) // failed
        .mockResolvedValueOnce(0); // pending

      mockPrisma.webhookDelivery.aggregate.mockResolvedValue({
        _avg: {
          latencyMs: null,
        },
      });

      const result = await service.getSubscriptionMetrics('sub-123', 'org-123');

      expect(result.successRate).toBe(0);
      expect(result.avgLatencyMs).toBe(0);
    });
  });

  describe('retryDelivery', () => {
    it('should not retry successful deliveries', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        status: 'SUCCESS',
        attempts: 1,
      };

      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(mockDelivery);

      await expect(service.retryDelivery('delivery-123')).rejects.toThrow(
        'Cannot retry successful delivery',
      );
    });

    it('should not retry if max attempts exceeded', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        status: 'FAILED',
        attempts: 3,
      };

      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(mockDelivery);

      await expect(service.retryDelivery('delivery-123')).rejects.toThrow(
        'Maximum retry attempts exceeded',
      );
    });
  });
});
