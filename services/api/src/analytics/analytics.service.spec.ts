import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    client: {
      orderItem: {
        groupBy: jest.fn(),
      },
      menuItem: {
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTopItems', () => {
    it('should return top items without cost data when includeCostData=false', async () => {
      mockPrismaService.client.orderItem.groupBy.mockResolvedValue([
        {
          menuItemId: 'item-1',
          _sum: { quantity: 100, subtotal: 5000 },
          _count: 25,
        },
        {
          menuItemId: 'item-2',
          _sum: { quantity: 80, subtotal: 4000 },
          _count: 20,
        },
      ]);

      mockPrismaService.client.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Burger' },
        { id: 'item-2', name: 'Pizza' },
      ]);

      const result = await service.getTopItems('branch-1', 10, false);

      expect(result).toEqual([
        {
          id: 'item-1',
          name: 'Burger',
          totalQuantity: 100,
          orderCount: 25,
          totalRevenue: 5000,
        },
        {
          id: 'item-2',
          name: 'Pizza',
          totalQuantity: 80,
          orderCount: 20,
          totalRevenue: 4000,
        },
      ]);

      // Verify groupBy was called WITHOUT cost fields
      expect(mockPrismaService.client.orderItem.groupBy).toHaveBeenCalledWith({
        by: ['menuItemId'],
        where: {
          order: {
            branchId: 'branch-1',
            status: { in: ['CLOSED', 'SERVED'] },
          },
        },
        _sum: {
          quantity: true,
          subtotal: true,
        },
        _count: true,
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 10,
      });
    });

    it('should return top items WITH cost data when includeCostData=true', async () => {
      mockPrismaService.client.orderItem.groupBy.mockResolvedValue([
        {
          menuItemId: 'item-1',
          _sum: {
            quantity: 100,
            subtotal: 5000,
            costTotal: 3000,
            marginTotal: 2000,
          },
          _count: 25,
        },
      ]);

      mockPrismaService.client.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Burger' },
      ]);

      const result = await service.getTopItems('branch-1', 10, true);

      expect(result).toEqual([
        {
          id: 'item-1',
          name: 'Burger',
          totalQuantity: 100,
          orderCount: 25,
          totalRevenue: 5000,
          totalCost: 3000,
          totalMargin: 2000,
          marginPct: 40, // (2000 / 5000) * 100
        },
      ]);

      // Verify groupBy was called WITH cost fields
      expect(mockPrismaService.client.orderItem.groupBy).toHaveBeenCalledWith({
        by: ['menuItemId'],
        where: {
          order: {
            branchId: 'branch-1',
            status: { in: ['CLOSED', 'SERVED'] },
          },
        },
        _sum: {
          quantity: true,
          subtotal: true,
          costTotal: true,
          marginTotal: true,
        },
        _count: true,
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 10,
      });
    });

    it('should calculate marginPct correctly', async () => {
      mockPrismaService.client.orderItem.groupBy.mockResolvedValue([
        {
          menuItemId: 'item-1',
          _sum: {
            quantity: 50,
            subtotal: 10000, // Revenue: 10,000
            costTotal: 6000, // Cost: 6,000
            marginTotal: 4000, // Margin: 4,000
          },
          _count: 10,
        },
      ]);

      mockPrismaService.client.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Steak' },
      ]);

      const result = await service.getTopItems('branch-1', 10, true);

      expect(result[0].marginPct).toBe(40); // (4000 / 10000) * 100 = 40%
    });

    it('should handle null cost data gracefully', async () => {
      mockPrismaService.client.orderItem.groupBy.mockResolvedValue([
        {
          menuItemId: 'item-1',
          _sum: {
            quantity: 50,
            subtotal: 5000,
            costTotal: null, // No cost data yet
            marginTotal: null,
          },
          _count: 10,
        },
      ]);

      mockPrismaService.client.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'New Item' },
      ]);

      const result = await service.getTopItems('branch-1', 10, true);

      // Should not include cost/margin fields when data is null
      expect(result).toEqual([
        {
          id: 'item-1',
          name: 'New Item',
          totalQuantity: 50,
          orderCount: 10,
          totalRevenue: 5000,
        },
      ]);
    });

    it('should respect the limit parameter', async () => {
      mockPrismaService.client.orderItem.groupBy.mockResolvedValue([]);
      mockPrismaService.client.menuItem.findMany.mockResolvedValue([]);

      await service.getTopItems('branch-1', 25, false);

      expect(mockPrismaService.client.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });
  });
});
