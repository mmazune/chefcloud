import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('WebhookSubscriptionsService', () => {
  let service: WebhookSubscriptionsService;
  let prismaService: PrismaService;

  const mockPrisma = {
    webhookSubscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    webhookDelivery: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WebhookSubscriptionsService>(WebhookSubscriptionsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    it('should create a subscription with valid HTTPS URL', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'https://example.com/webhook',
        eventTypes: ['order.created', 'payment.succeeded'],
      };

      mockPrisma.webhookSubscription.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'sub-123',
          orgId: args.data.orgId,
          url: args.data.url,
          eventTypes: args.data.eventTypes,
          secret: args.data.secret,
          status: args.data.status,
          createdByUserId: args.data.createdByUserId,
        });
      });

      const result = await service.createSubscription(dto, 'user-123');

      expect(result.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
      expect(result.warning).toContain('secret');
      expect(result.url).toBe('https://example.com/webhook');
      expect(result.orgId).toBe('org-123');
    });

    it('should create a subscription with valid HTTP URL', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'http://localhost:3000/webhook',
        eventTypes: ['order.created'],
      };

      mockPrisma.webhookSubscription.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'sub-123',
          ...args.data,
        });
      });

      const result = await service.createSubscription(dto, 'user-123');

      expect(result.url).toBe('http://localhost:3000/webhook');
    });

    it('should reject invalid URL protocols', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'ftp://example.com/webhook',
        eventTypes: ['order.created'],
      };

      await expect(service.createSubscription(dto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject malformed URLs', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'not-a-valid-url',
        eventTypes: ['order.created'],
      };

      await expect(service.createSubscription(dto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid event type patterns', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'https://example.com/webhook',
        eventTypes: ['invalid-event'],
      };

      await expect(service.createSubscription(dto, 'user-123')).rejects.toThrow(
        'Invalid event type format',
      );
    });

    it('should accept valid event type patterns', async () => {
      const dto = {
        orgId: 'org-123',
        url: 'https://example.com/webhook',
        eventTypes: [
          'order.created',
          'payment.succeeded',
          'inventory.low',
          'shift.opened',
        ],
      };

      mockPrisma.webhookSubscription.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'sub-123',
          ...args.data,
        });
      });

      const result = await service.createSubscription(dto, 'user-123');

      expect(result.eventTypes).toHaveLength(4);
    });
  });

  describe('disableSubscription', () => {
    it('should disable an active subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        orgId: 'org-123',
        status: 'ACTIVE',
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webhookSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'DISABLED',
      });

      const result = await service.disableSubscription('sub-123', 'org-123');

      expect(result.status).toBe('DISABLED');
      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: {
          status: 'DISABLED',
          disabledAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(null);

      await expect(service.disableSubscription('sub-999', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException if orgId mismatch', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        orgId: 'org-456',
        status: 'ACTIVE',
      });

      await expect(service.disableSubscription('sub-123', 'org-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('enableSubscription', () => {
    it('should enable a disabled subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        orgId: 'org-123',
        status: 'DISABLED',
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webhookSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });

      const result = await service.enableSubscription('sub-123', 'org-123');

      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('regenerateSecret', () => {
    it('should generate a new secret', async () => {
      const mockSubscription = {
        id: 'sub-123',
        orgId: 'org-123',
        secret: 'whsec_old',
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webhookSubscription.update.mockImplementation((args: any) => {
        return Promise.resolve({
          ...mockSubscription,
          secret: args.data.secret,
        });
      });

      const result = await service.regenerateSecret('sub-123', 'org-123');

      expect(result.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
      expect(result.warning).toContain('Secret regenerated');
    });
  });

  describe('updateSubscription', () => {
    it('should update URL and event types', async () => {
      const mockSubscription = {
        id: 'sub-123',
        orgId: 'org-123',
        url: 'https://old.com/webhook',
        eventTypes: ['order.created'],
      };

      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webhookSubscription.update.mockResolvedValue({
        ...mockSubscription,
        url: 'https://new.com/webhook',
        eventTypes: ['order.created', 'payment.succeeded'],
      });

      const result = await service.updateSubscription('sub-123', 'org-123', {
        url: 'https://new.com/webhook',
        eventTypes: ['order.created', 'payment.succeeded'],
      });

      expect(result.url).toBe('https://new.com/webhook');
      expect(result.eventTypes).toHaveLength(2);
    });

    it('should validate new URL if provided', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        orgId: 'org-123',
      });

      await expect(
        service.updateSubscription('sub-123', 'org-123', {
          url: 'ftp://invalid.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate new event types if provided', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        orgId: 'org-123',
      });

      await expect(
        service.updateSubscription('sub-123', 'org-123', {
          eventTypes: ['invalid-format'],
        }),
      ).rejects.toThrow('Invalid event type format');
    });
  });

  describe('listSubscriptions', () => {
    it('should list subscriptions with delivery counts', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          orgId: 'org-123',
          url: 'https://example.com/webhook',
          eventTypes: ['order.created'],
          status: 'ACTIVE',
          _count: {
            deliveries: 10,
          },
        },
        {
          id: 'sub-2',
          orgId: 'org-123',
          url: 'https://example2.com/webhook',
          eventTypes: ['payment.succeeded'],
          status: 'DISABLED',
          _count: {
            deliveries: 5,
          },
        },
      ];

      mockPrisma.webhookSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await service.listSubscriptions('org-123');

      expect(result).toHaveLength(2);
      expect(result[0]._count.deliveries).toBe(10);
      expect(result[1]._count.deliveries).toBe(5);
    });
  });
});
