import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DevPortalService } from './dev-portal.service';
import { PrismaService } from '../prisma.service';

describe('DevPortalService', () => {
  let service: DevPortalService;

  const mockPrisma = {
    subscriptionPlan: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    org: {
      create: jest.fn(),
    },
    orgSettings: {
      create: jest.fn(),
    },
    branch: {
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
    orgSubscription: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    subscriptionEvent: {
      create: jest.fn(),
    },
    devAdmin: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevPortalService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DevPortalService>(DevPortalService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('upsertPlan', () => {
    it('should create a new plan', async () => {
      const planData = {
        code: 'TEST',
        name: 'Test Plan',
        priceUGX: 100000,
        features: { maxBranches: 3 },
        isActive: true,
      };

      mockPrisma.subscriptionPlan.upsert.mockResolvedValue({
        id: 'plan-1',
        ...planData,
      });

      const result = await service.upsertPlan(planData);

      expect(result).toHaveProperty('id', 'plan-1');
      expect(result).toHaveProperty('code', 'TEST');
      expect(mockPrisma.subscriptionPlan.upsert).toHaveBeenCalledWith({
        where: { code: 'TEST' },
        create: expect.objectContaining({
          code: 'TEST',
          name: 'Test Plan',
          priceUGX: 100000,
        }),
        update: expect.objectContaining({
          name: 'Test Plan',
          priceUGX: 100000,
        }),
      });
    });

    it('should update an existing plan', async () => {
      const planData = {
        code: 'BASIC',
        name: 'Basic Plan Updated',
        priceUGX: 60000,
        features: { maxBranches: 2 },
        isActive: true,
      };

      mockPrisma.subscriptionPlan.upsert.mockResolvedValue({
        id: 'plan-basic',
        ...planData,
      });

      const result = await service.upsertPlan(planData);

      expect(result).toHaveProperty('name', 'Basic Plan Updated');
      expect(mockPrisma.subscriptionPlan.upsert).toHaveBeenCalled();
    });
  });

  describe('manageDevAdmin', () => {
    it('should add a new dev admin', async () => {
      mockPrisma.devAdmin.upsert.mockResolvedValue({
        id: 'dev-1',
        email: 'newdev@chefcloud.local',
        isSuper: false,
        createdAt: new Date(),
      });

      const result = await service.manageDevAdmin('add', 'newdev@chefcloud.local', false);

      expect(result).toHaveProperty('email', 'newdev@chefcloud.local');
      expect(mockPrisma.devAdmin.upsert).toHaveBeenCalledWith({
        where: { email: 'newdev@chefcloud.local' },
        create: { email: 'newdev@chefcloud.local', isSuper: false },
        update: { isSuper: false },
      });
    });

    it('should add a super dev admin', async () => {
      mockPrisma.devAdmin.upsert.mockResolvedValue({
        id: 'dev-super',
        email: 'superdev@chefcloud.local',
        isSuper: true,
        createdAt: new Date(),
      });

      const result = await service.manageDevAdmin('add', 'superdev@chefcloud.local', true);

      expect(result).toHaveProperty('isSuper', true);
    });

    it('should remove a regular dev admin', async () => {
      mockPrisma.devAdmin.findUnique.mockResolvedValue({
        id: 'dev-1',
        email: 'regulardev@chefcloud.local',
        isSuper: false,
        createdAt: new Date(),
      });

      mockPrisma.devAdmin.delete.mockResolvedValue({
        id: 'dev-1',
        email: 'regulardev@chefcloud.local',
        isSuper: false,
        createdAt: new Date(),
      });

      await service.manageDevAdmin('remove', 'regulardev@chefcloud.local');

      expect(mockPrisma.devAdmin.delete).toHaveBeenCalledWith({
        where: { email: 'regulardev@chefcloud.local' },
      });
    });

    it('should refuse to remove super dev if only 2 exist', async () => {
      mockPrisma.devAdmin.findUnique.mockResolvedValue({
        id: 'dev-super',
        email: 'dev1@chefcloud.local',
        isSuper: true,
        createdAt: new Date(),
      });

      mockPrisma.devAdmin.count.mockResolvedValue(2);

      await expect(
        service.manageDevAdmin('remove', 'dev1@chefcloud.local'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.manageDevAdmin('remove', 'dev1@chefcloud.local'),
      ).rejects.toThrow('Cannot remove super dev: minimum 2 required');

      expect(mockPrisma.devAdmin.delete).not.toHaveBeenCalled();
    });

    it('should allow removing super dev if more than 2 exist', async () => {
      mockPrisma.devAdmin.findUnique.mockResolvedValue({
        id: 'dev-super',
        email: 'dev3@chefcloud.local',
        isSuper: true,
        createdAt: new Date(),
      });

      mockPrisma.devAdmin.count.mockResolvedValue(3);

      mockPrisma.devAdmin.delete.mockResolvedValue({
        id: 'dev-super',
        email: 'dev3@chefcloud.local',
        isSuper: true,
        createdAt: new Date(),
      });

      await service.manageDevAdmin('remove', 'dev3@chefcloud.local');

      expect(mockPrisma.devAdmin.delete).toHaveBeenCalled();
    });

    it('should reject invalid action', async () => {
      await expect(
        service.manageDevAdmin('invalid' as any, 'test@test.com'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.manageDevAdmin('invalid' as any, 'test@test.com'),
      ).rejects.toThrow('Invalid action');
    });
  });

  describe('createOrg', () => {
    it('should create org with ACTIVE subscription', async () => {
      const planMock = {
        id: 'plan-basic',
        code: 'BASIC',
        name: 'Basic Plan',
        priceUGX: 50000,
        features: {},
        isActive: true,
      };

      const orgMock = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const branchMock = {
        id: 'branch-1',
        orgId: 'org-1',
        name: 'Main Branch',
        address: 'TBD',
        timezone: 'Africa/Kampala',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userMock = {
        id: 'user-1',
        email: 'owner@testorg.local',
        firstName: 'Owner',
        lastName: 'Account',
        roleLevel: 'L5',
        orgId: 'org-1',
        branchId: 'branch-1',
        isActive: true,
        passwordHash: 'hash',
        pinHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscriptionMock = {
        id: 'sub-1',
        orgId: 'org-1',
        planId: 'plan-basic',
        status: 'ACTIVE',
        nextRenewalAt: new Date(),
        graceUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(planMock);
      mockPrisma.org.create.mockResolvedValue(orgMock);
      mockPrisma.orgSettings.create.mockResolvedValue({});
      mockPrisma.branch.create.mockResolvedValue(branchMock);
      mockPrisma.user.create.mockResolvedValue(userMock);
      mockPrisma.orgSubscription.create.mockResolvedValue(subscriptionMock);
      mockPrisma.subscriptionEvent.create.mockResolvedValue({});

      const result = await service.createOrg({
        ownerEmail: 'owner@testorg.local',
        orgName: 'Test Org',
        planCode: 'BASIC',
      });

      expect(result).toHaveProperty('org');
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('subscription');
      expect(result.org.name).toBe('Test Org');
      expect(result.subscription.status).toBe('ACTIVE');
    });

    it('should reject inactive plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-inactive',
        code: 'INACTIVE',
        name: 'Inactive Plan',
        priceUGX: 0,
        features: {},
        isActive: false,
      });

      await expect(
        service.createOrg({
          ownerEmail: 'test@test.com',
          orgName: 'Test',
          planCode: 'INACTIVE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrg({
          ownerEmail: 'test@test.com',
          orgName: 'Test',
          planCode: 'NONEXISTENT',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listSubscriptions', () => {
    it('should list all subscriptions with org and plan details', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          orgId: 'org-1',
          planId: 'plan-1',
          status: 'ACTIVE',
          nextRenewalAt: new Date(),
          graceUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          org: {
            id: 'org-1',
            name: 'Org 1',
            slug: 'org-1',
          },
          plan: {
            code: 'BASIC',
            name: 'Basic Plan',
          },
        },
        {
          id: 'sub-2',
          orgId: 'org-2',
          planId: 'plan-2',
          status: 'GRACE',
          nextRenewalAt: new Date(),
          graceUntil: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          org: {
            id: 'org-2',
            name: 'Org 2',
            slug: 'org-2',
          },
          plan: {
            code: 'PRO',
            name: 'Pro Plan',
          },
        },
      ];

      mockPrisma.orgSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await service.listSubscriptions();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('org');
      expect(result[0]).toHaveProperty('plan');
      expect(result[0].status).toBe('ACTIVE');
      expect(mockPrisma.orgSubscription.findMany).toHaveBeenCalledWith({
        include: {
          org: { select: { id: true, name: true, slug: true } },
          plan: { select: { code: true, name: true } },
        },
        orderBy: { nextRenewalAt: 'asc' },
      });
    });
  });
});
