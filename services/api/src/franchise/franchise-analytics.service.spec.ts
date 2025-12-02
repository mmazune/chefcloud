// services/api/src/franchise/franchise-analytics.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import { PrismaService } from '../prisma.service';
import { FranchiseRankingMetric } from './dto/franchise-rankings.dto';

describe('FranchiseAnalyticsService', () => {
  let service: FranchiseAnalyticsService;
  let prismaService: any; // Using 'any' to allow mocking Prisma client methods

  const mockOrgId = 'org-test-123';
  const mockBranches = [
    { id: 'branch-1', name: 'Downtown Branch' },
    { id: 'branch-2', name: 'Uptown Branch' },
    { id: 'branch-3', name: 'Airport Branch' },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      client: {
        branch: {
          findMany: jest.fn(),
        },
        order: {
          groupBy: jest.fn(),
        },
        orderItem: {
          groupBy: jest.fn(),
        },
        wastage: {
          findMany: jest.fn(),
          groupBy: jest.fn(),
        },
        stockCount: {
          findMany: jest.fn(),
          groupBy: jest.fn(),
        },
        stockBatch: {
          findFirst: jest.fn(),
        },
        staffAward: {
          findMany: jest.fn(),
        },
        staffKpiSnapshot: {
          groupBy: jest.fn(),
        },
      },
      branch: {
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      orderItem: {
        groupBy: jest.fn(),
      },
      wastage: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      stockCount: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      staffAward: {
        findMany: jest.fn(),
      },
      staffKpiSnapshot: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FranchiseAnalyticsService>(FranchiseAnalyticsService);
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverviewForOrg', () => {
    it('should return empty arrays when no branches found', async () => {
      prismaService.branch.findMany.mockResolvedValue([]);
      prismaService.wastage.findMany.mockResolvedValue([]);
      prismaService.client.stockCount.findMany.mockResolvedValue([]);
      prismaService.staffAward.findMany.mockResolvedValue([]);

      const result = await service.getOverviewForOrg(mockOrgId, {});

      expect(result.branches).toEqual([]);
      expect(result.totals.netSales).toBe(0);
      expect(result.totals.totalOrders).toBe(0);
    });

    it('should aggregate metrics correctly for multiple branches', async () => {
      prismaService.branch.findMany.mockResolvedValue(mockBranches);

      // Mock order aggregates (Prisma v5 format: _count is number)
      prismaService.order.groupBy.mockResolvedValueOnce([
        {
          branchId: 'branch-1',
          _sum: {
            subtotal: 100000, // gross
            total: 90000, // net (after discount)
            tax: 0,
            discount: 10000,
          },
          _count: 10,
        },
        {
          branchId: 'branch-2',
          _sum: {
            subtotal: 200000,
            total: 180000,
            tax: 0,
            discount: 20000,
          },
          _count: 20,
        },
      ] as any);

      // Mock voided order aggregates (Prisma v5 format: _count is number)
      prismaService.order.groupBy.mockResolvedValueOnce([
        {
          branchId: 'branch-2',
          _count: 1,
        },
      ] as any);

      prismaService.orderItem.groupBy.mockResolvedValue([] as any);
      prismaService.wastage.findMany.mockResolvedValue([] as any);
      prismaService.client.stockCount.findMany.mockResolvedValue([] as any);
      prismaService.staffAward.findMany.mockResolvedValue([] as any);

      const result = await service.getOverviewForOrg(mockOrgId, {
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      });

      expect(result.branches).toHaveLength(3);

      // Branch 1
      const branch1 = result.branches.find((b) => b.branchId === 'branch-1');
      expect(branch1).toBeDefined();
      expect(branch1!.grossSales).toBe(100000);
      expect(branch1!.netSales).toBe(90000);
      expect(branch1!.totalOrders).toBe(10);
      expect(branch1!.avgCheck).toBe(9000); // 90000 / 10
      expect(branch1!.marginAmount).toBe(54000); // 90000 * 0.6
      expect(branch1!.marginPercent).toBe(60); // (54000 / 90000) * 100
      expect(branch1!.cancelledOrders).toBe(0); // CANCELLED status doesn't exist
      expect(branch1!.voidedOrders).toBe(0);

      // Branch 2
      const branch2 = result.branches.find((b) => b.branchId === 'branch-2');
      expect(branch2).toBeDefined();
      expect(branch2!.grossSales).toBe(200000);
      expect(branch2!.netSales).toBe(180000);
      expect(branch2!.totalOrders).toBe(20);
      expect(branch2!.cancelledOrders).toBe(0); // CANCELLED status doesn't exist
      expect(branch2!.voidedOrders).toBe(1);

      // Branch 3 (no orders)
      const branch3 = result.branches.find((b) => b.branchId === 'branch-3');
      expect(branch3).toBeDefined();
      expect(branch3!.netSales).toBe(0);
      expect(branch3!.totalOrders).toBe(0);

      // Totals
      expect(result.totals.grossSales).toBe(300000);
      expect(result.totals.netSales).toBe(270000);
      expect(result.totals.totalOrders).toBe(30);
      expect(result.totals.marginAmount).toBe(162000); // 54000 + 108000
      expect(result.totals.marginPercent).toBe(60); // (162000 / 270000) * 100
    });

    it('should filter by branchIds when provided', async () => {
      const filteredBranches = [mockBranches[0], mockBranches[1]];
      prismaService.branch.findMany.mockResolvedValue(filteredBranches);
      prismaService.order.groupBy.mockResolvedValue([]);
      prismaService.orderItem.groupBy.mockResolvedValue([]);
      prismaService.wastage.findMany.mockResolvedValue([]);
      prismaService.client.stockCount.findMany.mockResolvedValue([]);
      prismaService.staffAward.findMany.mockResolvedValue([]);

      await service.getOverviewForOrg(mockOrgId, {
        branchIds: ['branch-1', 'branch-2'],
      });

      expect(prismaService.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['branch-1', 'branch-2'] },
          }),
        }),
      );
    });

    // E22-S2: Test waste, shrinkage, and staff KPI metrics
    it('should populate waste, shrinkage, and staff KPI fields correctly', async () => {
      prismaService.branch.findMany.mockResolvedValue([
        mockBranches[0], // branch-1
        mockBranches[1], // branch-2
      ]);

      // Branch 1: netSales $10 (1000 cents), waste $10 (1000 cents), shrink $5 (500 cents)
      // This gives wastePercent = 100%, shrinkagePercent = 50%
      // Branch 2: netSales 0, waste $2, shrink $1
      prismaService.order.groupBy.mockResolvedValueOnce([
        {
          branchId: 'branch-1',
          _sum: { subtotal: 1100, total: 1000, tax: 0, discount: 100 }, // total in cents
          _count: 10,
        },
      ] as any);

      prismaService.order.groupBy.mockResolvedValueOnce([] as any);
      prismaService.orderItem.groupBy.mockResolvedValue([] as any);

      // Mock waste data: branch-1 has 10 units @ 100 cents = 1 dollar/unit
      prismaService.wastage.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          qty: 10,
          item: { stockBatches: [{ unitCost: 1 }] }, // 10 * 1 * 100 = 1000 cents
        },
        {
          branchId: 'branch-2',
          qty: 2,
          item: { stockBatches: [{ unitCost: 1 }] }, // 2 * 1 * 100 = 200 cents
        },
      ] as any);

      // Mock shrinkage data: branch-1 has 5 units shrinkage @ $1 = 500 cents
      prismaService.client.stockCount.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          lines: [{ itemId: 'item-1', countedQty: 95, expectedQty: 100 }], // 5 shrinkage
        },
        {
          branchId: 'branch-2',
          lines: [{ itemId: 'item-1', countedQty: 99, expectedQty: 100 }], // 1 shrinkage
        },
      ] as any);
      
      // Mock stockBatch for shrinkage cost lookup
      prismaService.client.stockBatch.findFirst.mockResolvedValue({
        unitCost: 1, // $1 per unit
      } as any);

      // Mock staff award data: branch-1 has scores of 0.8 and 0.9 (avg 0.85 → 85%)
      // Scores are stored as 0-1 decimals, converted to 0-100 in service
      prismaService.staffAward.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          score: 0.8, // 80%
        },
        {
          branchId: 'branch-1',
          score: 0.9, // 90%
        },
        // branch-2 has no staff awards
      ] as any);

      const result = await service.getOverviewForOrg(mockOrgId, {});

      expect(result.branches).toHaveLength(2);

      // Branch 1 assertions
      const branch1 = result.branches.find((b) => b.branchId === 'branch-1');
      expect(branch1).toBeDefined();
      expect(branch1!.netSales).toBe(1000); // cents
      expect(branch1!.wasteValue).toBe(1000); // cents (10 units * $1)
      expect(branch1!.shrinkValue).toBe(500); // cents (5 units * $1)
      expect(branch1!.wastePercent).toBe(100); // (1000 / 1000) * 100
      expect(branch1!.shrinkagePercent).toBe(50); // (500 / 1000) * 100
      expect(branch1!.staffKpiScore).toBe(85); // avg of 80 and 90

      // Branch 2 assertions (no sales, so percentages = 0)
      const branch2 = result.branches.find((b) => b.branchId === 'branch-2');
      expect(branch2).toBeDefined();
      expect(branch2!.netSales).toBe(0);
      expect(branch2!.wasteValue).toBe(200); // 2 * 100 cents
      expect(branch2!.shrinkValue).toBe(100); // 1 * 100 cents
      expect(branch2!.wastePercent).toBe(0); // no sales, so 0%
      expect(branch2!.shrinkagePercent).toBe(0); // no sales, so 0%
      expect(branch2!.staffKpiScore).toBe(0); // no awards
    });
  });

  describe('getRankingsForOrg', () => {
    beforeEach(() => {
      prismaService.branch.findMany.mockResolvedValue(mockBranches);
      prismaService.order.groupBy.mockResolvedValueOnce([
        {
          branchId: 'branch-1',
          _sum: { subtotal: 100000, total: 90000, tax: 0, discount: 10000 },
          _count: 10,
        },
        {
          branchId: 'branch-2',
          _sum: { subtotal: 200000, total: 180000, tax: 0, discount: 20000 },
          _count: 20,
        },
        {
          branchId: 'branch-3',
          _sum: { subtotal: 150000, total: 140000, tax: 0, discount: 10000 },
          _count: 15,
        },
      ] as any);
      prismaService.order.groupBy.mockResolvedValueOnce([]);
      prismaService.orderItem.groupBy.mockResolvedValue([]);
      
      // E22-S2: Mock waste data (using findMany for wastage records)
      // unitCost is in dollars, converted to cents in service (* 100)
      prismaService.wastage.findMany.mockResolvedValue([
        { branchId: 'branch-1', qty: 10, item: { stockBatches: [{ unitCost: 0.9 }] } }, // 10 * 0.9 * 100 = 900 cents
        { branchId: 'branch-2', qty: 4, item: { stockBatches: [{ unitCost: 0.9 }] } }, // 4 * 0.9 * 100 = 360 cents
        { branchId: 'branch-3', qty: 10, item: { stockBatches: [{ unitCost: 1.4 }] } }, // 10 * 1.4 * 100 = 1400 cents
      ] as any);
      
      // E22-S2: Mock shrinkage data (using findMany for stock counts)
      // Branch 1: 5 units @ $0.9 = 450 cents, Branch 2: 8 units @ $0.9 = 720 cents, Branch 3: 2 units @ $1.4 = 280 cents
      prismaService.client.stockCount.findMany.mockResolvedValue([
        { branchId: 'branch-1', lines: [{ itemId: 'item-1', countedQty: 95, expectedQty: 100 }] }, // 5 shrinkage
        { branchId: 'branch-2', lines: [{ itemId: 'item-1', countedQty: 92, expectedQty: 100 }] }, // 8 shrinkage
        { branchId: 'branch-3', lines: [{ itemId: 'item-1', countedQty: 98, expectedQty: 100 }] }, // 2 shrinkage
      ] as any);
      
      // Mock stockBatch for shrinkage cost lookup (returns different costs for different lookups)
      let callCount = 0;
      prismaService.client.stockBatch.findFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ unitCost: 0.9 } as any); // branch-1
        if (callCount === 2) return Promise.resolve({ unitCost: 0.9 } as any); // branch-2
        return Promise.resolve({ unitCost: 1.4 } as any); // branch-3
      });
      
      // E22-S2: Mock staff KPI data (using staffAward with scores as 0-1 decimals)
      prismaService.staffAward.findMany.mockResolvedValue([
        { branchId: 'branch-1', score: 0.75 }, // 75%
        { branchId: 'branch-1', score: 0.75 }, // avg = 75
        { branchId: 'branch-2', score: 0.90 }, // 90%
        { branchId: 'branch-2', score: 0.90 }, // avg = 90
        { branchId: 'branch-3', score: 0.82 }, // 82%
        { branchId: 'branch-3', score: 0.82 }, // avg = 82
      ] as any);
    });

    it('should rank branches by NET_SALES descending', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.NET_SALES,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.metric).toBe(FranchiseRankingMetric.NET_SALES);

      // Check sorting and ranking
      expect(result.entries[0].branchId).toBe('branch-2');
      expect(result.entries[0].value).toBe(180000);
      expect(result.entries[0].rank).toBe(1);

      expect(result.entries[1].branchId).toBe('branch-3');
      expect(result.entries[1].value).toBe(140000);
      expect(result.entries[1].rank).toBe(2);

      expect(result.entries[2].branchId).toBe('branch-1');
      expect(result.entries[2].value).toBe(90000);
      expect(result.entries[2].rank).toBe(3);
    });

    it('should rank branches by MARGIN_PERCENT descending', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.MARGIN_PERCENT,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.metric).toBe(FranchiseRankingMetric.MARGIN_PERCENT);

      // All branches should have 60% margin in this mock
      result.entries.forEach((entry) => {
        expect(entry.value).toBe(60);
      });
    });

    it('should apply limit when specified', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.NET_SALES,
        limit: 2,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[1].rank).toBe(2);
    });

    // E22-S2: Test new ranking metrics
    it('should rank branches by WASTE_PERCENT descending (worst offenders first)', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.WASTE_PERCENT,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.metric).toBe(FranchiseRankingMetric.WASTE_PERCENT);

      // Branch 1: 1% (900 cents / 90000 cents * 100), Branch 3: 1% (1400/140000*100), Branch 2: 0.2% (360/180000*100)
      // Since sorting is descending, highest waste comes first
      expect(result.entries[0].value).toBeCloseTo(1, 2);
      expect(result.entries[2].branchId).toBe('branch-2');
      expect(result.entries[2].value).toBeCloseTo(0.2, 2);
    });

    it('should rank branches by SHRINKAGE_PERCENT descending', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.SHRINKAGE_PERCENT,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.metric).toBe(FranchiseRankingMetric.SHRINKAGE_PERCENT);

      // Branch 1: 0.5% (450 cents / 90000 cents * 100), Branch 2: 0.4% (720/180000*100), Branch 3: 0.2% (280/140000*100)
      expect(result.entries[0].branchId).toBe('branch-1');
      expect(result.entries[0].value).toBeCloseTo(0.5, 2);
      expect(result.entries[1].branchId).toBe('branch-2');
      expect(result.entries[1].value).toBeCloseTo(0.4, 2);
      expect(result.entries[2].branchId).toBe('branch-3');
      expect(result.entries[2].value).toBeCloseTo(0.2, 2);
    });

    it('should rank branches by STAFF_KPI_SCORE descending (best first)', async () => {
      const result = await service.getRankingsForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.STAFF_KPI_SCORE,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.metric).toBe(FranchiseRankingMetric.STAFF_KPI_SCORE);

      // Branch 2: 90, Branch 3: 82, Branch 1: 75
      expect(result.entries[0].branchId).toBe('branch-2');
      expect(result.entries[0].value).toBe(90);
      expect(result.entries[1].branchId).toBe('branch-3');
      expect(result.entries[1].value).toBe(82);
      expect(result.entries[2].branchId).toBe('branch-1');
      expect(result.entries[2].value).toBe(75);
    });
  });

  describe('Date range resolution', () => {
    it('should handle explicit start and end dates', async () => {
      prismaService.branch.findMany.mockResolvedValue([]);

      const result = await service.getOverviewForOrg(mockOrgId, {
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      });

      expect(result.fromDate).toContain('2025-12-01');
      expect(result.toDate).toContain('2026-01-01'); // Next day for exclusive upper bound
    });

    it('should default to today when dates omitted', async () => {
      prismaService.branch.findMany.mockResolvedValue([]);

      const result = await service.getOverviewForOrg(mockOrgId, {});

      expect(result.fromDate).toBeDefined();
      expect(result.toDate).toBeDefined();
    });
  });

  // E22-S3: Budget tests
  describe('getBudgetsForOrg', () => {
    beforeEach(() => {
      // Add franchiseBudget mock to prismaService
      prismaService.franchiseBudget = {
        findMany: jest.fn(),
        upsert: jest.fn(),
      };
    });

    it('should return budgets with branch names', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          orgId: mockOrgId,
          branchId: 'branch-1',
          year: 2025,
          month: 5,
          category: 'NET_SALES',
          amountCents: 5000000,
          currencyCode: 'UGX',
          branch: { id: 'branch-1', name: 'Downtown Branch' },
        },
        {
          id: 'budget-2',
          orgId: mockOrgId,
          branchId: 'branch-2',
          year: 2025,
          month: 5,
          category: 'NET_SALES',
          amountCents: 3000000,
          currencyCode: 'UGX',
          branch: { id: 'branch-2', name: 'Uptown Branch' },
        },
      ];

      prismaService.franchiseBudget.findMany.mockResolvedValue(mockBudgets);

      const result = await service.getBudgetsForOrg(mockOrgId, {
        year: 2025,
        month: 5,
      });

      expect(result).toHaveLength(2);
      expect(result[0].branchName).toBe('Downtown Branch');
      expect(result[0].amountCents).toBe(5000000);
      expect(result[1].branchName).toBe('Uptown Branch');
      expect(prismaService.franchiseBudget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: mockOrgId,
            year: 2025,
            month: 5,
          }),
        }),
      );
    });

    it('should filter by branchIds when provided', async () => {
      prismaService.franchiseBudget.findMany.mockResolvedValue([]);

      await service.getBudgetsForOrg(mockOrgId, {
        branchIds: ['branch-1', 'branch-2'],
      });

      expect(prismaService.franchiseBudget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { in: ['branch-1', 'branch-2'] },
          }),
        }),
      );
    });
  });

  describe('upsertBudgetsForOrg', () => {
    beforeEach(() => {
      prismaService.franchiseBudget = {
        findMany: jest.fn(),
        upsert: jest.fn(),
      };
    });

    it('should call upsert for each budget item', async () => {
      const payload = {
        items: [
          {
            branchId: 'branch-1',
            year: 2025,
            month: 5,
            category: 'NET_SALES' as const,
            amountCents: 5000000,
            currencyCode: 'UGX',
          },
          {
            branchId: 'branch-2',
            year: 2025,
            month: 5,
            category: 'NET_SALES' as const,
            amountCents: 3000000,
            currencyCode: 'UGX',
          },
        ],
      };

      prismaService.franchiseBudget.upsert.mockResolvedValue({});

      await service.upsertBudgetsForOrg(mockOrgId, payload);

      expect(prismaService.franchiseBudget.upsert).toHaveBeenCalledTimes(2);
      expect(prismaService.franchiseBudget.upsert).toHaveBeenCalledWith({
        where: {
          franchise_budget_period_key: {
            orgId: mockOrgId,
            branchId: 'branch-1',
            year: 2025,
            month: 5,
            category: 'NET_SALES',
          },
        },
        update: {
          amountCents: 5000000,
          currencyCode: 'UGX',
        },
        create: expect.objectContaining({
          orgId: mockOrgId,
          branchId: 'branch-1',
          amountCents: 5000000,
        }),
      });
    });
  });

  describe('getBudgetVarianceForOrg', () => {
    beforeEach(() => {
      prismaService.franchiseBudget = {
        findMany: jest.fn(),
        upsert: jest.fn(),
      };
    });

    it('should return empty array when no budgets found', async () => {
      prismaService.franchiseBudget.findMany.mockResolvedValue([]);

      const result = await service.getBudgetVarianceForOrg(mockOrgId, {
        year: 2025,
        month: 5,
      });

      expect(result.year).toBe(2025);
      expect(result.month).toBe(5);
      expect(result.branches).toEqual([]);
    });

    it('should calculate variance correctly (positive = over-performance)', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          orgId: mockOrgId,
          branchId: 'branch-1',
          year: 2025,
          month: 5,
          category: 'NET_SALES',
          amountCents: 5000000, // Budget: 50,000 UGX
          currencyCode: 'UGX',
          branch: { id: 'branch-1', name: 'Downtown Branch' },
        },
        {
          id: 'budget-2',
          orgId: mockOrgId,
          branchId: 'branch-2',
          year: 2025,
          month: 5,
          category: 'NET_SALES',
          amountCents: 3000000, // Budget: 30,000 UGX
          currencyCode: 'UGX',
          branch: { id: 'branch-2', name: 'Uptown Branch' },
        },
      ];

      // Branch 1: Actual 55,000 (over-performance: +10%)
      // Branch 2: Actual 0 (under-performance: -100%)
      const mockSalesRows = [
        {
          branchId: 'branch-1',
          _sum: { total: 5500000 }, // Actual: 55,000 UGX
        },
        // branch-2 has no sales
      ];

      prismaService.franchiseBudget.findMany.mockResolvedValue(mockBudgets);
      prismaService.order.groupBy.mockResolvedValue(mockSalesRows);

      const result = await service.getBudgetVarianceForOrg(mockOrgId, {
        year: 2025,
        month: 5,
      });

      expect(result.branches).toHaveLength(2);

      // Branch 1: Over-performance
      const branch1 = result.branches.find((b) => b.branchId === 'branch-1');
      expect(branch1).toBeDefined();
      expect(branch1!.budgetAmountCents).toBe(5000000);
      expect(branch1!.actualNetSalesCents).toBe(5500000);
      expect(branch1!.varianceAmountCents).toBe(500000); // 5,500,000 - 5,000,000
      expect(branch1!.variancePercent).toBe(10); // (500,000 / 5,000,000) * 100

      // Branch 2: Under-performance (no sales)
      const branch2 = result.branches.find((b) => b.branchId === 'branch-2');
      expect(branch2).toBeDefined();
      expect(branch2!.budgetAmountCents).toBe(3000000);
      expect(branch2!.actualNetSalesCents).toBe(0);
      expect(branch2!.varianceAmountCents).toBe(-3000000); // 0 - 3,000,000
      expect(branch2!.variancePercent).toBe(-100); // (-3,000,000 / 3,000,000) * 100
    });

    it('should handle zero budget gracefully', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          orgId: mockOrgId,
          branchId: 'branch-1',
          year: 2025,
          month: 5,
          category: 'NET_SALES',
          amountCents: 0, // Zero budget
          currencyCode: 'UGX',
          branch: { id: 'branch-1', name: 'Downtown Branch' },
        },
      ];

      const mockSalesRows = [
        {
          branchId: 'branch-1',
          _sum: { total: 1000000 }, // Actual: 10,000 UGX
        },
      ];

      prismaService.franchiseBudget.findMany.mockResolvedValue(mockBudgets);
      prismaService.order.groupBy.mockResolvedValue(mockSalesRows);

      const result = await service.getBudgetVarianceForOrg(mockOrgId, {
        year: 2025,
        month: 5,
      });

      const branch1 = result.branches[0];
      expect(branch1.variancePercent).toBe(0); // Avoid division by zero
    });
  });

  // E22-S5: Forecast tests
  describe('getForecastForOrg', () => {
    function makeOrder(branchId: string, isoDate: string, total: number) {
      return {
        branchId,
        createdAt: new Date(isoDate),
        total,
        branch: { id: branchId, name: `Branch ${branchId}` },
      };
    }

    it('should return empty array when no historical orders', async () => {
      prismaService.order.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2025,
        month: 1,
        lookbackMonths: 3,
      } as any);

      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
      expect(result.lookbackMonths).toBe(3);
      expect(result.branches).toHaveLength(0);
    });

    it('should compute forecast per branch using weekday averages', async () => {
      // Two Mondays and one Tuesday in lookback, all for branch A
      prismaService.order.findMany = jest.fn().mockResolvedValue([
        makeOrder('branch-A', '2024-10-07T12:00:00Z', 10000), // Monday
        makeOrder('branch-A', '2024-10-14T12:00:00Z', 20000), // Monday
        makeOrder('branch-A', '2024-10-08T12:00:00Z', 5000), // Tuesday
      ]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2024,
        month: 11,
        lookbackMonths: 1,
      } as any);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(11);
      expect(result.branches).toHaveLength(1);

      const branch = result.branches[0];
      expect(branch.branchId).toBe('branch-A');
      expect(branch.branchName).toBe('Branch branch-A');
      expect(branch.historicalNetSalesCents).toBe(10000 + 20000 + 5000);
      expect(branch.coverageDays).toBe(3);

      // Assert forecast is > 0 and roughly in the right magnitude
      expect(branch.forecastNetSalesCents).toBeGreaterThan(0);
      // November 2024 has 30 days, with weekday distribution
      // Should be roughly historical total * (days in month / coverage days)
      expect(branch.forecastNetSalesCents).toBeGreaterThan(30000);
    });

    it('should respect branchIds filter when provided', async () => {
      prismaService.order.findMany = jest.fn().mockResolvedValue([
        makeOrder('branch-A', '2024-10-07T12:00:00Z', 10000),
        makeOrder('branch-B', '2024-10-07T12:00:00Z', 15000),
      ]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2024,
        month: 11,
        lookbackMonths: 1,
        branchIds: ['branch-A'],
      } as any);

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { in: ['branch-A'] },
          }),
        }),
      );

      // Should return all branches from actual orders returned (mock returns both)
      // In real scenario, Prisma would filter, but our mock returns both
      expect(result.branches.length).toBeGreaterThanOrEqual(1);
    });

    it('should use default lookbackMonths of 3 when not specified', async () => {
      prismaService.order.findMany = jest.fn().mockResolvedValue([
        makeOrder('branch-A', '2024-10-07T12:00:00Z', 10000),
      ]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2025,
        month: 1,
        // lookbackMonths not specified, should default to 3
      } as any);

      expect(result.lookbackMonths).toBe(3);
    });

    it('should handle multiple branches with different sales patterns', async () => {
      prismaService.order.findMany = jest.fn().mockResolvedValue([
        // Branch A: High sales
        makeOrder('branch-A', '2024-10-07T12:00:00Z', 50000), // Monday
        makeOrder('branch-A', '2024-10-14T12:00:00Z', 55000), // Monday
        // Branch B: Lower sales
        makeOrder('branch-B', '2024-10-07T12:00:00Z', 20000), // Monday
        makeOrder('branch-B', '2024-10-14T12:00:00Z', 22000), // Monday
      ]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2024,
        month: 11,
        lookbackMonths: 1,
      } as any);

      expect(result.branches).toHaveLength(2);

      // Should be sorted by forecast descending
      expect(result.branches[0].branchId).toBe('branch-A');
      expect(result.branches[1].branchId).toBe('branch-B');

      // Branch A should have higher forecast
      expect(result.branches[0].forecastNetSalesCents).toBeGreaterThan(
        result.branches[1].forecastNetSalesCents,
      );
    });

    it('should calculate avgDailyNetSalesCents correctly', async () => {
      prismaService.order.findMany = jest.fn().mockResolvedValue([
        makeOrder('branch-A', '2024-10-07T12:00:00Z', 10000), // Day 1
        makeOrder('branch-A', '2024-10-08T12:00:00Z', 20000), // Day 2
        makeOrder('branch-A', '2024-10-09T12:00:00Z', 30000), // Day 3
      ]);

      const result = await service.getForecastForOrg(mockOrgId, {
        year: 2024,
        month: 11,
        lookbackMonths: 1,
      } as any);

      const branch = result.branches[0];
      // Total: 60000 over 3 days = 20000 per day
      expect(branch.avgDailyNetSalesCents).toBe(20000);
      expect(branch.coverageDays).toBe(3);
    });
  });

  // E22-S6: CSV Export Tests

  describe('getOverviewCsvForOrg', () => {
    it('should call getOverviewForOrg and return CSV string', async () => {
      const overviewMock = {
        branches: [
          {
            branchId: 'b1',
            branchName: 'Branch 1',
            grossSales: 1000,
            netSales: 800,
            totalOrders: 10,
            avgCheck: 80,
            totalGuests: 20,
            marginAmount: 200,
            marginPercent: 25,
            cancelledOrders: 1,
            voidedOrders: 0,
            wasteValue: 50,
            shrinkValue: 30,
            wastePercent: 6.25,
            shrinkagePercent: 3.75,
            staffKpiScore: 85,
          },
        ],
        totals: {} as any,
        fromDate: '2025-01-01',
        toDate: '2025-01-31',
      };

      jest
        .spyOn(service, 'getOverviewForOrg')
        .mockResolvedValueOnce(overviewMock as any);

      const csv = await service.getOverviewCsvForOrg(mockOrgId, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      } as any);

      expect(service.getOverviewForOrg).toHaveBeenCalledWith(mockOrgId, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
      expect(csv).toContain('branchId,branchName');
      expect(csv).toContain('b1');
      expect(csv).toContain('Branch 1');
      expect(csv).toContain('1000');
      expect(csv).toContain('800');
    });
  });

  describe('getRankingsCsvForOrg', () => {
    it('should call getRankingsForOrg and return CSV string', async () => {
      const rankingsMock = {
        fromDate: '2025-01-01',
        toDate: '2025-01-31',
        metric: FranchiseRankingMetric.NET_SALES,
        entries: [
          {
            rank: 1,
            branchId: 'branch-1',
            branchName: 'Top Branch',
            value: 100000,
          },
          {
            rank: 2,
            branchId: 'branch-2',
            branchName: 'Second Branch',
            value: 80000,
          },
        ],
      };

      jest
        .spyOn(service, 'getRankingsForOrg')
        .mockResolvedValueOnce(rankingsMock as any);

      const csv = await service.getRankingsCsvForOrg(mockOrgId, {
        metric: FranchiseRankingMetric.NET_SALES,
      } as any);

      expect(service.getRankingsForOrg).toHaveBeenCalled();
      expect(csv).toContain('metric,rank,branchId,branchName,value');
      expect(csv).toContain('NET_SALES');
      expect(csv).toContain('Top Branch');
      expect(csv).toContain('100000');
    });
  });

  describe('getBudgetsCsvForOrg', () => {
    it('should call getBudgetsForOrg and return CSV string', async () => {
      const budgetsMock = [
        {
          id: 'budget-1',
          branchId: 'branch-1',
          branchName: 'Branch 1',
          year: 2025,
          month: 1,
          category: 'NET_SALES',
          amountCents: 5000000,
          currencyCode: 'UGX',
        },
        {
          id: 'budget-2',
          branchId: 'branch-2',
          branchName: 'Branch 2',
          year: 2025,
          month: 1,
          category: 'NET_SALES',
          amountCents: 3000000,
          currencyCode: 'UGX',
        },
      ];

      jest
        .spyOn(service, 'getBudgetsForOrg')
        .mockResolvedValueOnce(budgetsMock as any);

      const csv = await service.getBudgetsCsvForOrg(mockOrgId, {
        year: 2025,
        month: 1,
      } as any);

      expect(service.getBudgetsForOrg).toHaveBeenCalled();
      expect(csv).toContain('branchId,branchName,year,month,category,amountCents,currencyCode');
      expect(csv).toContain('branch-1');
      expect(csv).toContain('Branch 1');
      expect(csv).toContain('2025');
      expect(csv).toContain('5000000');
    });
  });

  describe('getBudgetVarianceCsvForOrg', () => {
    it('should call getBudgetVarianceForOrg and return CSV string', async () => {
      const varianceMock = {
        year: 2025,
        month: 1,
        branches: [
          {
            branchId: 'branch-1',
            branchName: 'Branch 1',
            budgetAmountCents: 5000000,
            actualNetSalesCents: 5500000,
            varianceAmountCents: 500000,
            variancePercent: 10,
          },
          {
            branchId: 'branch-2',
            branchName: 'Branch 2',
            budgetAmountCents: 3000000,
            actualNetSalesCents: 2800000,
            varianceAmountCents: -200000,
            variancePercent: -6.67,
          },
        ],
      };

      jest
        .spyOn(service, 'getBudgetVarianceForOrg')
        .mockResolvedValueOnce(varianceMock as any);

      const csv = await service.getBudgetVarianceCsvForOrg(mockOrgId, {
        year: 2025,
        month: 1,
      } as any);

      expect(service.getBudgetVarianceForOrg).toHaveBeenCalled();
      expect(csv).toContain('branchId,branchName,year,month,budgetAmountCents,actualNetSalesCents,varianceAmountCents,variancePercent');
      expect(csv).toContain('branch-1');
      expect(csv).toContain('Branch 1');
      expect(csv).toContain('5000000');
      expect(csv).toContain('5500000');
      expect(csv).toContain('500000');
      expect(csv).toContain('10');
    });
  });

  describe('getForecastCsvForOrg', () => {
    it('should call getForecastForOrg and return CSV with headers and rows', async () => {
      const forecastMock = {
        year: 2025,
        month: 1,
        lookbackMonths: 3,
        branches: [
          {
            branchId: 'b1',
            branchName: 'Branch 1',
            year: 2025,
            month: 1,
            forecastNetSalesCents: 500000,
            historicalNetSalesCents: 450000,
            avgDailyNetSalesCents: 15000,
            coverageDays: 30,
          },
        ],
      } as any;

      const spy = jest
        .spyOn(service, 'getForecastForOrg')
        .mockResolvedValueOnce(forecastMock);

      const csv = await service.getForecastCsvForOrg(mockOrgId, {
        year: 2025,
        month: 1,
      } as any);

      expect(spy).toHaveBeenCalledWith(mockOrgId, {
        year: 2025,
        month: 1,
      } as any);

      // Header line
      expect(csv).toContain(
        'branchId,branchName,year,month,lookbackMonths,forecastNetSalesCents,historicalNetSalesCents,avgDailyNetSalesCents,coverageDays',
      );

      // Data line
      expect(csv).toContain('b1');
      expect(csv).toContain('Branch 1');
      expect(csv).toContain('500000');
      expect(csv).toContain('450000');
      expect(csv).toContain('15000');
      expect(csv).toContain('30');
    });

    it('should handle empty forecast result with header only', async () => {
      jest.spyOn(service, 'getForecastForOrg').mockResolvedValueOnce({
        year: 2025,
        month: 1,
        lookbackMonths: 3,
        branches: [],
      } as any);

      const csv = await service.getForecastCsvForOrg(mockOrgId, {
        year: 2025,
        month: 1,
      } as any);

      // One header + no data rows
      const lines = csv.split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('branchId,branchName');
    });
  });
});
