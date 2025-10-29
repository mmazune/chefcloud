import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma.service';

describe('BillingService', () => {
  let service: BillingService;

  const mockPrisma = {
    orgSubscription: {
      findUnique: jest.fn(),
    },
    subscriptionPlan: {
      findUnique: jest.fn(),
    },
    subscriptionEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);

    jest.clearAllMocks();
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const mockSubscription = {
        id: 'sub-1',
        orgId: 'org-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        nextRenewalAt: new Date('2025-11-29'),
        graceUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: 'plan-1',
          code: 'PRO',
          name: 'Pro Plan',
          priceUGX: 150000,
          features: { maxBranches: 5 },
          isActive: true,
        },
      };

      mockPrisma.orgSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('org-1');

      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('status', 'ACTIVE');
      expect(result).toHaveProperty('nextRenewalAt');
      expect(result.plan.code).toBe('PRO');
      expect(mockPrisma.orgSubscription.findUnique).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        include: { plan: true },
      });
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      mockPrisma.orgSubscription.findUnique.mockResolvedValue(null);

      await expect(service.getSubscription('org-nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.getSubscription('org-nonexistent')).rejects.toThrow(
        'No active subscription',
      );
    });
  });

  describe('requestPlanChange', () => {
    it('should log plan change request', async () => {
      const mockPlan = {
        id: 'plan-enterprise',
        code: 'ENTERPRISE',
        name: 'Enterprise Plan',
        priceUGX: 500000,
        features: {},
        isActive: true,
      };

      const mockSubscription = {
        id: 'sub-1',
        orgId: 'org-1',
        planId: 'plan-pro',
        status: 'ACTIVE',
        nextRenewalAt: new Date('2025-11-29'),
        graceUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.orgSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const result = await service.requestPlanChange('org-1', 'ENTERPRISE');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('effectiveDate');
      expect(result.requestedPlan).toBe('plan-enterprise');
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          type: 'RENEWAL_DUE',
          meta: {
            requestedPlan: 'ENTERPRISE',
            currentPlanId: 'plan-pro',
          },
        },
      });
    });

    it('should throw NotFoundException for inactive plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-inactive',
        code: 'INACTIVE',
        name: 'Inactive',
        priceUGX: 0,
        features: {},
        isActive: false,
      });

      await expect(service.requestPlanChange('org-1', 'INACTIVE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.requestPlanChange('org-1', 'NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if org has no subscription', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        code: 'PRO',
        name: 'Pro',
        priceUGX: 150000,
        features: {},
        isActive: true,
      });

      mockPrisma.orgSubscription.findUnique.mockResolvedValue(null);

      await expect(service.requestPlanChange('org-nosub', 'PRO')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('requestCancellation', () => {
    it('should log cancellation request', async () => {
      const mockSubscription = {
        id: 'sub-1',
        orgId: 'org-1',
        planId: 'plan-1',
        status: 'ACTIVE',
        nextRenewalAt: new Date('2025-11-29'),
        graceUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.orgSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const result = await service.requestCancellation('org-1');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('effectiveDate');
      expect(result.effectiveDate).toEqual(mockSubscription.nextRenewalAt);
      expect(mockPrisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          type: 'CANCELLED',
          meta: expect.objectContaining({
            effectiveDate: mockSubscription.nextRenewalAt,
          }),
        },
      });
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      mockPrisma.orgSubscription.findUnique.mockResolvedValue(null);

      await expect(service.requestCancellation('org-nosub')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
