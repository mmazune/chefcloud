import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma.service';

describe('InventoryService - Adjustments', () => {
  let service: InventoryService;

  const mockPrismaClient = {
    inventoryItem: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    stockBatch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    adjustment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAdjustment', () => {
    it('should create positive adjustment and update newest batch', async () => {
      const orgId = 'org1';
      const branchId = 'branch1';
      const itemId = 'item1';
      const deltaQty = 10;
      const reason = 'Physical count - found extra stock';
      const adjustedBy = 'user1';

      const mockBatch = {
        id: 'batch1',
        branchId,
        itemId,
        remainingQty: 50,
        totalQty: 100,
      };

      const mockAdjustment = {
        id: 'adj1',
        orgId,
        branchId,
        itemId,
        deltaQty,
        reason,
        adjustedBy,
        createdAt: new Date(),
      };

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        mockPrismaClient.adjustment.create.mockResolvedValue(mockAdjustment);
        mockPrismaClient.stockBatch.findFirst.mockResolvedValue(mockBatch);
        mockPrismaClient.stockBatch.update.mockResolvedValue({ ...mockBatch, remainingQty: 60 });
        return callback(mockPrismaClient);
      });

      const result = await service.createAdjustment(
        orgId,
        branchId,
        itemId,
        deltaQty,
        reason,
        adjustedBy,
      );

      expect(result).toEqual(mockAdjustment);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockPrismaClient.adjustment.create).toHaveBeenCalledWith({
        data: {
          orgId,
          branchId,
          itemId,
          deltaQty,
          reason,
          adjustedBy,
        },
      });
    });

    it('should create negative adjustment and use FIFO consumption', async () => {
      const orgId = 'org1';
      const branchId = 'branch1';
      const itemId = 'item1';
      const deltaQty = -15;
      const reason = 'Damaged goods removal';
      const adjustedBy = 'user1';

      const mockBatches = [
        { id: 'batch1', remainingQty: 10 },
        { id: 'batch2', remainingQty: 20 },
      ];

      const mockAdjustment = {
        id: 'adj1',
        orgId,
        branchId,
        itemId,
        deltaQty,
        reason,
        adjustedBy,
        createdAt: new Date(),
      };

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        mockPrismaClient.adjustment.create.mockResolvedValue(mockAdjustment);
        mockPrismaClient.stockBatch.findMany.mockResolvedValue(mockBatches);
        mockPrismaClient.stockBatch.update.mockResolvedValue({});
        return callback(mockPrismaClient);
      });

      const result = await service.createAdjustment(
        orgId,
        branchId,
        itemId,
        deltaQty,
        reason,
        adjustedBy,
      );

      expect(result).toEqual(mockAdjustment);
      expect(mockPrismaClient.stockBatch.findMany).toHaveBeenCalledWith({
        where: {
          branchId,
          itemId,
          remainingQty: { gt: 0 },
        },
        orderBy: { receivedAt: 'asc' },
      });
    });
  });
});
