import { Test, TestingModule } from '@nestjs/testing';
import { PurchasingService } from './purchasing.service';
import { PrismaService } from '../prisma.service';
import { CacheInvalidationService } from '../common/cache-invalidation.service';
import { BadRequestException } from '@nestjs/common';

describe('PurchasingService - E22.D.3', () => {
  let service: PurchasingService;
  let cacheInvalidation: CacheInvalidationService;

  const mockPrismaClient = {
    purchaseOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    goodsReceipt: {
      create: jest.fn(),
      count: jest.fn(),
    },
    stockBatch: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPrismaService = {
    client: mockPrismaClient,
  };

  const mockCacheInvalidation = {
    onPoReceived: jest.fn().mockResolvedValue(undefined),
    onInventoryAdjusted: jest.fn().mockResolvedValue(undefined),
    onTransferChanged: jest.fn().mockResolvedValue(undefined),
    onBudgetUpdated: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasingService,
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

    service = module.get<PurchasingService>(PurchasingService);
    cacheInvalidation = module.get<CacheInvalidationService>(CacheInvalidationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('receivePO - E22.D.3 Cache Invalidation', () => {
    it('should trigger cache invalidation after successful PO receipt', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const poId = 'PO-789';
      const dto = {
        receivedBy: 'USER-123',
        items: [
          {
            itemId: 'ITEM-1',
            receivedQty: 100,
            unitCost: 50,
          },
        ],
      };

      const mockPO = {
        id: poId,
        orgId,
        status: 'placed',
        items: [
          {
            id: 'POI-1',
            itemId: 'ITEM-1',
            orderedQty: 100,
            unitCost: 50,
          },
        ],
      };

      const mockGR = {
        id: 'GR-1',
        orgId,
        poId,
        receivedAt: new Date(),
      };

      mockPrismaClient.purchaseOrder.findUnique.mockResolvedValue(mockPO);
      mockPrismaClient.purchaseOrder.update.mockResolvedValue({ ...mockPO, status: 'received' });
      mockPrismaClient.goodsReceipt.count.mockResolvedValue(0);
      mockPrismaClient.goodsReceipt.create.mockResolvedValue(mockGR);
      mockPrismaClient.stockBatch.create.mockResolvedValue({ id: 'BATCH-1' });

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      const result = await service.receivePO(poId, dto, orgId, branchId);

      expect(result).toEqual(mockGR);
      expect(cacheInvalidation.onPoReceived).toHaveBeenCalledWith(orgId);
      expect(cacheInvalidation.onPoReceived).toHaveBeenCalledTimes(1);
    });

    it('should not throw if cache invalidation fails', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const poId = 'PO-789';
      const dto = {
        receivedBy: 'USER-456',
        items: [
          {
            itemId: 'ITEM-1',
            receivedQty: 100,
            unitCost: 50,
          },
        ],
      };

      const mockPO = {
        id: poId,
        orgId,
        status: 'placed',
        items: [
          {
            id: 'POI-1',
            itemId: 'ITEM-1',
            orderedQty: 100,
            unitCost: 50,
          },
        ],
      };

      const mockGR = {
        id: 'GR-2',
        orgId,
        poId,
        receivedAt: new Date(),
      };

      mockPrismaClient.purchaseOrder.findUnique.mockResolvedValue(mockPO);
      mockPrismaClient.purchaseOrder.update.mockResolvedValue({ ...mockPO, status: 'received' });
      mockPrismaClient.goodsReceipt.count.mockResolvedValue(1);
      mockPrismaClient.goodsReceipt.create.mockResolvedValue(mockGR);
      mockPrismaClient.stockBatch.create.mockResolvedValue({ id: 'BATCH-1' });

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      // Make cache invalidation fail
      jest.spyOn(cacheInvalidation, 'onPoReceived').mockRejectedValue(new Error('Redis down'));

      // Should not throw - invalidation is non-blocking
      await expect(service.receivePO(poId, dto, orgId, branchId)).resolves.toBeDefined();

      // Cache invalidation was attempted
      expect(cacheInvalidation.onPoReceived).toHaveBeenCalledWith(orgId);
    });

    it('should throw BadRequestException if PO not found', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const poId = 'PO-NONEXISTENT';
      const dto = {
        receivedBy: 'USER-789',
        items: [
          {
            itemId: 'ITEM-1',
            receivedQty: 100,
            unitCost: 50,
          },
        ],
      };

      mockPrismaClient.purchaseOrder.findUnique.mockResolvedValue(null);

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await expect(service.receivePO(poId, dto, orgId, branchId)).rejects.toThrow(
        BadRequestException,
      );

      // Cache invalidation should NOT be called if PO not found
      expect(cacheInvalidation.onPoReceived).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if PO status is not placed', async () => {
      const orgId = 'ORG-123';
      const branchId = 'BRANCH-456';
      const poId = 'PO-456';
      const dto = {
        receivedBy: 'USER-999',
        items: [
          {
            itemId: 'ITEM-1',
            receivedQty: 100,
            unitCost: 50,
          },
        ],
      };

      const mockPO = {
        id: poId,
        orgId,
        status: 'draft',
        items: [],
      };

      mockPrismaClient.purchaseOrder.findUnique.mockResolvedValue(mockPO);

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaClient);
      });

      await expect(service.receivePO(poId, dto, orgId, branchId)).rejects.toThrow(
        BadRequestException,
      );

      // Cache invalidation should NOT be called if PO status is invalid
      expect(cacheInvalidation.onPoReceived).not.toHaveBeenCalled();
    });
  });
});
