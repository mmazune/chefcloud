import { Test, TestingModule } from '@nestjs/testing';
import { AccessService, DEFAULT_PLATFORM_ACCESS } from './access.service';
import { PrismaService } from '../prisma.service';

describe('AccessService', () => {
  let service: AccessService;
  let prismaService: PrismaService;

  const mockOrgId = 'test-org-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessService,
        {
          provide: PrismaService,
          useValue: {
            orgSettings: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AccessService>(AccessService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMatrix', () => {
    it('should return defaults when no platformAccess is set', async () => {
      jest.spyOn(prismaService.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
        vatPercent: 18,
        currency: 'UGX',
        discountApprovalThreshold: 5000,
        reservationHoldMinutes: 30,
        receiptFooter: null,
        metadata: null,
        anomalyThresholds: null,
        platformAccess: null,
      } as any);

      const result = await service.getMatrix(mockOrgId);

      expect(result.platformAccess).toEqual(DEFAULT_PLATFORM_ACCESS);
      expect(result.defaults).toEqual(DEFAULT_PLATFORM_ACCESS);
    });

    it('should return stored platformAccess when set', async () => {
      const customAccess = {
        WAITER: { desktop: true, web: true, mobile: true },
        CASHIER: { desktop: false, web: true, mobile: false },
      };

      jest.spyOn(prismaService.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
        vatPercent: 18,
        currency: 'UGX',
        discountApprovalThreshold: 5000,
        reservationHoldMinutes: 30,
        receiptFooter: null,
        metadata: null,
        anomalyThresholds: null,
        platformAccess: customAccess,
      } as any);

      const result = await service.getMatrix(mockOrgId);

      expect(result.platformAccess).toEqual(customAccess);
      expect(result.defaults).toEqual(DEFAULT_PLATFORM_ACCESS);
    });
  });

  describe('patchMatrix', () => {
    it('should successfully update platformAccess with valid data', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
        CASHIER: { desktop: false, web: true, mobile: false },
      };

      jest.spyOn(prismaService.orgSettings, 'upsert').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
        vatPercent: 18,
        currency: 'UGX',
        discountApprovalThreshold: 5000,
        reservationHoldMinutes: 30,
        receiptFooter: null,
        metadata: null,
        anomalyThresholds: null,
        platformAccess: updates,
      } as any);

      const result = await service.patchMatrix(mockOrgId, updates);

      expect(result).toEqual(updates);
      expect(prismaService.orgSettings.upsert).toHaveBeenCalledWith({
        where: { orgId: mockOrgId },
        create: {
          orgId: mockOrgId,
          platformAccess: updates,
        },
        update: {
          platformAccess: updates,
        },
      });
    });

    it('should reject updates with non-object values', async () => {
      const invalidUpdates = {
        WAITER: 'invalid',
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: must be an object with desktop/web/mobile flags',
      );
    });

    it('should reject updates with null values', async () => {
      const invalidUpdates = {
        WAITER: null,
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: must be an object with desktop/web/mobile flags',
      );
    });

    it('should reject updates with non-boolean desktop value', async () => {
      const invalidUpdates = {
        WAITER: { desktop: 'yes', web: true, mobile: true },
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: desktop, web, and mobile must be booleans',
      );
    });

    it('should reject updates with non-boolean web value', async () => {
      const invalidUpdates = {
        WAITER: { desktop: true, web: 1, mobile: true },
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: desktop, web, and mobile must be booleans',
      );
    });

    it('should reject updates with non-boolean mobile value', async () => {
      const invalidUpdates = {
        WAITER: { desktop: true, web: true, mobile: null },
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: desktop, web, and mobile must be booleans',
      );
    });

    it('should reject updates with missing desktop flag', async () => {
      const invalidUpdates = {
        WAITER: { web: true, mobile: true },
      } as any;

      await expect(service.patchMatrix(mockOrgId, invalidUpdates)).rejects.toThrow(
        'Invalid config for role WAITER: desktop, web, and mobile must be booleans',
      );
    });

    it('should handle multiple roles in one update', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
        CASHIER: { desktop: false, web: true, mobile: false },
        PROCUREMENT: { desktop: true, web: false, mobile: false },
      };

      jest.spyOn(prismaService.orgSettings, 'upsert').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
        vatPercent: 18,
        currency: 'UGX',
        discountApprovalThreshold: 5000,
        reservationHoldMinutes: 30,
        receiptFooter: null,
        metadata: null,
        anomalyThresholds: null,
        platformAccess: updates,
      } as any);

      const result = await service.patchMatrix(mockOrgId, updates);

      expect(result).toEqual(updates);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset matrix to defaults and return updated:true', async () => {
      const customMatrix = {
        WAITER: { desktop: false, web: false, mobile: false },
      };

      jest.spyOn(prismaService.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        platformAccess: customMatrix,
      } as any);

      jest.spyOn(prismaService.orgSettings, 'upsert').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        platformAccess: DEFAULT_PLATFORM_ACCESS,
      } as any);

      const result = await service.resetToDefaults(mockOrgId, 'user-123');

      expect(result.updated).toBe(true);
      expect(result.matrix).toEqual(DEFAULT_PLATFORM_ACCESS);
      expect(prismaService.orgSettings.upsert).toHaveBeenCalledWith({
        where: { orgId: mockOrgId },
        create: {
          orgId: mockOrgId,
          platformAccess: DEFAULT_PLATFORM_ACCESS,
        },
        update: {
          platformAccess: DEFAULT_PLATFORM_ACCESS,
        },
      });
    });

    it('should return updated:false when matrix already matches defaults', async () => {
      jest.spyOn(prismaService.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        platformAccess: DEFAULT_PLATFORM_ACCESS,
      } as any);

      const result = await service.resetToDefaults(mockOrgId, 'user-123');

      expect(result.updated).toBe(false);
      expect(result.matrix).toEqual(DEFAULT_PLATFORM_ACCESS);
      expect(prismaService.orgSettings.upsert).not.toHaveBeenCalled();
    });

    it('should reset when platformAccess is null', async () => {
      jest.spyOn(prismaService.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        platformAccess: null,
      } as any);

      jest.spyOn(prismaService.orgSettings, 'upsert').mockResolvedValue({
        id: 'settings-id',
        orgId: mockOrgId,
        platformAccess: DEFAULT_PLATFORM_ACCESS,
      } as any);

      const result = await service.resetToDefaults(mockOrgId, 'user-123');

      expect(result.updated).toBe(true);
      expect(result.matrix).toEqual(DEFAULT_PLATFORM_ACCESS);
    });
  });
});
