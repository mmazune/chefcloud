import { Test, TestingModule } from '@nestjs/testing';
import { CostingService } from './costing.service';
import { PrismaService } from '../prisma.service';

describe('CostingService', () => {
  let service: CostingService;

  const mockPrisma = {
    client: {
      stockBatch: {
        findMany: jest.fn(),
      },
      recipeIngredient: {
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CostingService>(CostingService);
    jest.clearAllMocks();
  });

  describe('getWac', () => {
    it('should calculate WAC correctly with multiple batches', async () => {
      mockPrisma.client.stockBatch.findMany.mockResolvedValue([
        { unitCost: 100, remainingQty: 10 },
        { unitCost: 120, remainingQty: 5 },
      ]);

      const wac = await service.getWac('item-1');
      // (100*10 + 120*5) / (10+5) = 1600/15 = 106.67
      expect(wac).toBeCloseTo(106.67, 2);
    });

    it('should return 0 when no batches exist', async () => {
      mockPrisma.client.stockBatch.findMany.mockResolvedValue([]);
      const wac = await service.getWac('item-1');
      expect(wac).toBe(0);
    });

    it('should return 0 when total quantity is 0', async () => {
      mockPrisma.client.stockBatch.findMany.mockResolvedValue([
        { unitCost: 100, remainingQty: 0 },
      ]);
      const wac = await service.getWac('item-1');
      expect(wac).toBe(0);
    });
  });

  describe('getRecipeCost', () => {
    it('should calculate recipe cost without modifiers', async () => {
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValue([
        { itemId: 'item-1', qtyPerUnit: 2 },
        { itemId: 'item-2', qtyPerUnit: 1 },
      ]);

      mockPrisma.client.stockBatch.findMany
        .mockResolvedValueOnce([
          { unitCost: 100, remainingQty: 10 },
        ])
        .mockResolvedValueOnce([
          { unitCost: 50, remainingQty: 20 },
        ]);

      const cost = await service.getRecipeCost('menu-1');

      // 2*100 + 1*50 = 250
      expect(cost).toBe(250);
    });

    it('should include modifier ingredients when selected', async () => {
      // Base recipe
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValueOnce([
        { itemId: 'item-1', qtyPerUnit: 1 },
      ]);

      // Modifier recipe
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValueOnce([
        { itemId: 'item-2', qtyPerUnit: 0.5 },
      ]);

      mockPrisma.client.stockBatch.findMany
        .mockResolvedValueOnce([
          { unitCost: 100, remainingQty: 10 },
        ])
        .mockResolvedValueOnce([
          { unitCost: 200, remainingQty: 5 },
        ]);

      const cost = await service.getRecipeCost('menu-1', [
        { id: 'modifier-1', selected: true },
      ]);

      // 1*100 + 0.5*200 = 200
      expect(cost).toBe(200);
    });

    it('should exclude modifier ingredients when not selected', async () => {
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValueOnce([
        { itemId: 'item-1', qtyPerUnit: 1 },
      ]);

      mockPrisma.client.stockBatch.findMany.mockResolvedValueOnce([
        { unitCost: 100, remainingQty: 10 },
      ]);

      const cost = await service.getRecipeCost('menu-1', [
        { id: 'modifier-1', selected: false },
      ]);

      // Only base: 1*100 = 100
      expect(cost).toBe(100);
    });

    it('should handle micro-ingredients without zeroing', async () => {
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValue([
        { itemId: 'item-1', qtyPerUnit: 0.001 }, // 1 gram
      ]);

      mockPrisma.client.stockBatch.findMany.mockResolvedValue([
        { unitCost: 50000, remainingQty: 1 }, // 50k per kg
      ]);

      const cost = await service.getRecipeCost('menu-1');

      // 0.001 * 50000 = 50 (rounded WAC prevents zero)
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeCloseTo(50, 2);
    });
  });

  describe('calculateItemCosting', () => {
    it('should calculate cost and margin correctly', async () => {
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValue([
        { itemId: 'item-1', qtyPerUnit: 1 },
      ]);

      mockPrisma.client.stockBatch.findMany.mockResolvedValue([
        { unitCost: 100, remainingQty: 10 },
      ]);

      const result = await service.calculateItemCosting({
        menuItemId: 'menu-1',
        quantity: 2,
        unitPrice: 500,
        modifiersPrice: 100,
        discount: 50,
      });

      // costUnit = 100, costTotal = 200
      // lineNet = 500*2 + 100 - 50 = 1050
      // marginTotal = 1050 - 200 = 850
      // marginPct = 850/1050 * 100 = 80.95%

      expect(result.costUnit).toBe(100);
      expect(result.costTotal).toBe(200);
      expect(result.marginTotal).toBe(850);
      expect(result.marginPct).toBeCloseTo(80.95, 2);
    });

    it('should return 0% margin when lineNet is zero', async () => {
      mockPrisma.client.recipeIngredient.findMany.mockResolvedValue([
        { itemId: 'item-1', qtyPerUnit: 1 },
      ]);

      mockPrisma.client.stockBatch.findMany.mockResolvedValue([
        { unitCost: 100, remainingQty: 10 },
      ]);

      const result = await service.calculateItemCosting({
        menuItemId: 'menu-1',
        quantity: 1,
        unitPrice: 0,
        modifiersPrice: 0,
        discount: 0,
      });

      expect(result.marginPct).toBe(0);
    });
  });
});
