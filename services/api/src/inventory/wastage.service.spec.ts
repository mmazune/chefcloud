import { Test, TestingModule } from '@nestjs/testing';
import { WastageService } from './wastage.service';
import { PrismaService } from '../prisma.service';
import { CacheInvalidationService } from '../common/cache-invalidation.service';

describe('WastageService - E22.D.2', () => {
  let service: WastageService;

  const mockPrismaClient = {
    wastage: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    client: mockPrismaClient,
  };

  const mockCacheInvalidation = {
    onPoReceived: jest.fn().mockResolvedValue(undefined),
    onTransferChanged: jest.fn().mockResolvedValue(undefined),
    onBudgetUpdated: jest.fn().mockResolvedValue(undefined),
    onInventoryAdjusted: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WastageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockCacheInvalidation,
        },
      ],
    }).compile();

    service = module.get<WastageService>(WastageService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordWastage - E22.D.2 Cache Invalidation', () => {
    it('should trigger cache invalidation after recording wastage', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const userId = 'USER-789';
      const dto = {
        itemId: 'ITEM-999',
        qty: 5,
        reason: 'Expired',
      };

      const mockWastage = {
        id: 'WASTE-1',
        orgId,
        branchId,
        itemId: dto.itemId,
        qty: dto.qty,
        reason: dto.reason,
        reportedBy: userId,
        createdAt: new Date(),
      };

      mockPrismaClient.wastage.create.mockResolvedValue(mockWastage);

      const result = await service.recordWastage(orgId, branchId, userId, dto);

      expect(result).toEqual(mockWastage);

      // Verify cache invalidation was called with correct orgId
      expect(mockCacheInvalidation.onInventoryAdjusted).toHaveBeenCalledWith(orgId);
      expect(mockCacheInvalidation.onInventoryAdjusted).toHaveBeenCalledTimes(1);
    });

    it('should not throw if cache invalidation fails', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const userId = 'USER-789';
      const dto = {
        itemId: 'ITEM-999',
        qty: 5,
        reason: 'Damaged',
      };

      const mockWastage = {
        id: 'WASTE-2',
        orgId,
        branchId,
        itemId: dto.itemId,
        qty: dto.qty,
        reason: dto.reason,
        reportedBy: userId,
        createdAt: new Date(),
      };

      mockPrismaClient.wastage.create.mockResolvedValue(mockWastage);

      // Make cache invalidation fail
      mockCacheInvalidation.onInventoryAdjusted.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should not throw - invalidation is non-blocking
      await expect(service.recordWastage(orgId, branchId, userId, dto)).resolves.toBeDefined();

      // Cache invalidation was attempted
      expect(mockCacheInvalidation.onInventoryAdjusted).toHaveBeenCalledWith(orgId);
    });
  });
});
