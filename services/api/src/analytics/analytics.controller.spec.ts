import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;

  const mockAnalyticsService = {
    getTopItems: jest.fn(),
    getDailySummary: jest.fn(),
  };

  const mockPrismaService = {
    client: {
      orgSettings: {
        findUnique: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTopItems - RBAC for cost data', () => {
    it('should include cost data for OWNER (L5)', async () => {
      const req = {
        user: {
          roleLevel: 'L5',
          role: 'OWNER',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockAnalyticsService.getTopItems.mockResolvedValue([
        { id: 'item-1', name: 'Burger', totalCost: 300, totalMargin: 200, marginPct: 40 },
      ]);

      await controller.getTopItems(req);

      // Should call with includeCostData = true
      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, true);
    });

    it('should include cost data for MANAGER (L4)', async () => {
      const req = {
        user: {
          roleLevel: 'L4',
          role: 'MANAGER',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockAnalyticsService.getTopItems.mockResolvedValue([]);

      await controller.getTopItems(req);

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, true);
    });

    it('should include cost data for ACCOUNTANT role regardless of level', async () => {
      const req = {
        user: {
          roleLevel: 'L3',
          role: 'ACCOUNTANT',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockAnalyticsService.getTopItems.mockResolvedValue([]);

      await controller.getTopItems(req);

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, true);
    });

    it('should exclude cost data for CHEF (L3) when showCostToChef=false', async () => {
      const req = {
        user: {
          roleLevel: 'L3',
          role: 'CHEF',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockPrismaService.client.orgSettings.findUnique.mockResolvedValue({
        showCostToChef: false,
      });

      mockAnalyticsService.getTopItems.mockResolvedValue([
        { id: 'item-1', name: 'Burger' }, // No cost fields
      ]);

      await controller.getTopItems(req);

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, false);
    });

    it('should include cost data for CHEF (L3) when showCostToChef=true', async () => {
      const req = {
        user: {
          roleLevel: 'L3',
          role: 'CHEF',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockPrismaService.client.orgSettings.findUnique.mockResolvedValue({
        showCostToChef: true,
      });

      mockAnalyticsService.getTopItems.mockResolvedValue([
        { id: 'item-1', name: 'Burger', totalCost: 300, totalMargin: 200, marginPct: 40 },
      ]);

      await controller.getTopItems(req);

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, true);
    });

    it('should exclude cost data for WAITER (L2) when showCostToChef=false', async () => {
      const req = {
        user: {
          roleLevel: 'L2',
          role: 'WAITER',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockPrismaService.client.orgSettings.findUnique.mockResolvedValue({
        showCostToChef: false,
      });

      mockAnalyticsService.getTopItems.mockResolvedValue([]);

      await controller.getTopItems(req);

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 10, false);
    });

    it('should handle custom limit parameter', async () => {
      const req = {
        user: {
          roleLevel: 'L5',
          role: 'OWNER',
          branchId: 'branch-1',
          orgId: 'org-1',
        },
      };

      mockAnalyticsService.getTopItems.mockResolvedValue([]);

      await controller.getTopItems(req, '25');

      expect(analyticsService.getTopItems).toHaveBeenCalledWith('branch-1', 25, true);
    });
  });
});
