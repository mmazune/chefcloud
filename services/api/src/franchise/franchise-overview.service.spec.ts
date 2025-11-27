import { Test, TestingModule } from '@nestjs/testing';
import { FranchiseOverviewService } from './franchise-overview.service';
import { PrismaService } from '../prisma.service';
import { ReconciliationService } from '../inventory/reconciliation.service';
import { WastageService } from '../inventory/wastage.service';
import { WaiterMetricsService } from '../staff/waiter-metrics.service';

/**
 * M6: Franchise Overview Consistency Tests
 *
 * Ensures franchise-level aggregations match sum of individual branches
 * and use canonical services (M3, M5, M1) for consistent metrics.
 */
describe('FranchiseOverviewService - M6 Consistency Tests', () => {
  let service: FranchiseOverviewService;
  let prismaService: PrismaService;
  let reconciliationService: ReconciliationService;
  let wastageService: WastageService;
  let waiterMetricsService: WaiterMetricsService;

  const mockOrgId = 'org-franchise-test';
  const mockBranch1Id = 'branch-001';
  const mockBranch2Id = 'branch-002';
  const periodStart = new Date('2024-01-01T00:00:00Z');
  const periodEnd = new Date('2024-01-31T23:59:59Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseOverviewService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              branch: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
              },
              order: {
                findMany: jest.fn(),
              },
              branchBudget: {
                findUnique: jest.fn(),
              },
              kdsTicket: {
                findMany: jest.fn(),
              },
            },
          },
        },
        {
          provide: ReconciliationService,
          useValue: {
            reconcile: jest.fn(),
          },
        },
        {
          provide: WastageService,
          useValue: {
            getWastageSummary: jest.fn(),
          },
        },
        {
          provide: WaiterMetricsService,
          useValue: {
            getRankedWaiters: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FranchiseOverviewService>(FranchiseOverviewService);
    prismaService = module.get<PrismaService>(PrismaService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    wastageService = module.get<WastageService>(WastageService);
    waiterMetricsService = module.get<WaiterMetricsService>(WaiterMetricsService);
  });

  describe('getBranchMetrics', () => {
    it('should calculate metrics using canonical services', async () => {
      // Mock branch
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
        orgId: mockOrgId,
      } as any);

      // Mock orders (sales)
      jest
        .spyOn(prismaService.client.order, 'findMany')
        .mockResolvedValue([{ total: 100000 }, { total: 150000 }, { total: 200000 }] as any);

      // Mock reconciliation (COGS)
      jest.spyOn(reconciliationService, 'reconcile').mockResolvedValue([
        {
          itemId: 'item-001',
          itemName: 'Test Item',
          theoreticalUsageCost: 50000, // COGS
          varianceCost: 0,
          wastageCost: 0,
        },
        {
          itemId: 'item-002',
          itemName: 'Test Item 2',
          theoreticalUsageCost: 80000,
          varianceCost: 0,
          wastageCost: 0,
        },
      ] as any);

      // Mock wastage
      jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({
        totalQty: 10,
        totalCost: 15000,
        byReason: [],
        byUser: [],
      } as any);

      // Mock KDS tickets
      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([
        {
          sentAt: new Date('2024-01-01T12:00:00Z'),
          readyAt: new Date('2024-01-01T12:04:00Z'), // 4 min = GREEN
        },
        {
          sentAt: new Date('2024-01-01T13:00:00Z'),
          readyAt: new Date('2024-01-01T13:07:00Z'), // 7 min = ORANGE
        },
        {
          sentAt: new Date('2024-01-01T14:00:00Z'),
          readyAt: new Date('2024-01-01T14:15:00Z'), // 15 min = RED
        },
      ] as any);

      // Mock waiter metrics
      jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([
        { score: 0.8, rank: 1 },
        { score: 0.6, rank: 2 },
      ] as any);

      // Mock budget
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue({
        revenueTarget: 500000,
        cogsTarget: 150000,
      } as any);

      const result = await service.getBranchMetrics(
        mockOrgId,
        mockBranch1Id,
        periodStart,
        periodEnd,
      );

      expect(result.totalSales).toBe(450000); // 100k + 150k + 200k
      expect(result.orderCount).toBe(3);
      expect(result.totalCOGS).toBe(130000); // 50k + 80k from reconciliation
      expect(result.grossMargin).toBe(320000); // 450k - 130k
      expect(result.grossMarginPercent).toBeCloseTo(71.11, 1); // (320k / 450k) * 100
      expect(result.wastageCost).toBe(15000);
      expect(result.wastagePercent).toBeCloseTo(3.33, 1); // (15k / 450k) * 100
      expect(result.kdsSlaScore).toBeCloseTo(66.67, 1); // 2/3 tickets green/orange
      expect(result.staffScore).toBeGreaterThan(0); // Waiter score calculated
      expect(result.revenueTarget).toBe(500000);
      expect(result.revenueDelta).toBe(-50000); // 450k - 500k
    });

    it('should handle missing reconciliation data gracefully', async () => {
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
      } as any);

      jest
        .spyOn(prismaService.client.order, 'findMany')
        .mockResolvedValue([{ total: 100000 }] as any);

      // Reconciliation fails
      jest.spyOn(reconciliationService, 'reconcile').mockRejectedValue(new Error('No data'));

      jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({
        totalCost: 0,
      } as any);

      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([]);
      jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([]);
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue(null);

      const result = await service.getBranchMetrics(
        mockOrgId,
        mockBranch1Id,
        periodStart,
        periodEnd,
      );

      // Should fallback to 35% COGS estimate
      expect(result.totalCOGS).toBe(35000); // 100k * 0.35
      expect(result.grossMargin).toBe(65000);
    });

    it('should calculate KDS SLA correctly', async () => {
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
      } as any);

      jest.spyOn(prismaService.client.order, 'findMany').mockResolvedValue([]);
      jest.spyOn(reconciliationService, 'reconcile').mockResolvedValue([]);
      jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({ totalCost: 0 } as any);
      jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([]);
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue(null);

      // All green tickets
      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([
        {
          sentAt: new Date('2024-01-01T12:00:00Z'),
          readyAt: new Date('2024-01-01T12:03:00Z'), // 3 min
        },
        {
          sentAt: new Date('2024-01-01T13:00:00Z'),
          readyAt: new Date('2024-01-01T13:04:00Z'), // 4 min
        },
      ] as any);

      const result = await service.getBranchMetrics(
        mockOrgId,
        mockBranch1Id,
        periodStart,
        periodEnd,
      );

      expect(result.kdsSlaScore).toBe(100); // All green
    });
  });

  describe('getFranchiseSummary', () => {
    it('should aggregate metrics from all branches correctly', async () => {
      // Mock branches
      jest.spyOn(prismaService.client.branch, 'findMany').mockResolvedValue([
        { id: mockBranch1Id, name: 'Branch Alpha' },
        { id: mockBranch2Id, name: 'Branch Beta' },
      ] as any);

      // Mock getBranchMetrics for each branch
      jest
        .spyOn(service, 'getBranchMetrics')
        .mockResolvedValueOnce({
          branchId: mockBranch1Id,
          branchName: 'Branch Alpha',
          totalSales: 500000,
          orderCount: 100,
          avgOrderValue: 5000,
          totalCOGS: 175000,
          grossMargin: 325000,
          grossMarginPercent: 65,
          wastageCost: 20000,
          wastagePercent: 4,
          kdsSlaScore: 90,
          staffScore: 75,
          periodStart,
          periodEnd,
        } as any)
        .mockResolvedValueOnce({
          branchId: mockBranch2Id,
          branchName: 'Branch Beta',
          totalSales: 300000,
          orderCount: 60,
          avgOrderValue: 5000,
          totalCOGS: 120000,
          grossMargin: 180000,
          grossMarginPercent: 60,
          wastageCost: 15000,
          wastagePercent: 5,
          kdsSlaScore: 85,
          staffScore: 70,
          periodStart,
          periodEnd,
        } as any);

      const result = await service.getFranchiseSummary(mockOrgId, periodStart, periodEnd);

      // Verify aggregations
      expect(result.totalSales).toBe(800000); // 500k + 300k
      expect(result.totalCOGS).toBe(295000); // 175k + 120k
      expect(result.totalGrossMargin).toBe(505000); // 325k + 180k
      expect(result.totalWastageCost).toBe(35000); // 20k + 15k

      // Verify averages
      expect(result.avgGrossMarginPercent).toBeCloseTo(63.125, 1); // (505k / 800k) * 100
      expect(result.avgWastagePercent).toBeCloseTo(4.375, 1); // (35k / 800k) * 100
      expect(result.avgKdsSlaScore).toBe(87.5); // (90 + 85) / 2
      expect(result.avgStaffScore).toBe(72.5); // (75 + 70) / 2

      // Verify branch details
      expect(result.branches).toHaveLength(2);
      expect(result.branches[0].branchId).toBe(mockBranch1Id);
      expect(result.branches[1].branchId).toBe(mockBranch2Id);
    });

    it('should handle single branch correctly', async () => {
      jest
        .spyOn(prismaService.client.branch, 'findMany')
        .mockResolvedValue([{ id: mockBranch1Id, name: 'Branch Alpha' }] as any);

      jest.spyOn(service, 'getBranchMetrics').mockResolvedValueOnce({
        branchId: mockBranch1Id,
        branchName: 'Branch Alpha',
        totalSales: 500000,
        orderCount: 100,
        avgOrderValue: 5000,
        totalCOGS: 175000,
        grossMargin: 325000,
        grossMarginPercent: 65,
        wastageCost: 20000,
        wastagePercent: 4,
        kdsSlaScore: 90,
        staffScore: 75,
        periodStart,
        periodEnd,
      } as any);

      const result = await service.getFranchiseSummary(mockOrgId, periodStart, periodEnd);

      expect(result.totalSales).toBe(500000);
      expect(result.branches).toHaveLength(1);
      expect(result.avgGrossMarginPercent).toBe(65);
    });

    it('should throw error if no branches found', async () => {
      jest.spyOn(prismaService.client.branch, 'findMany').mockResolvedValue([]);

      await expect(service.getFranchiseSummary(mockOrgId, periodStart, periodEnd)).rejects.toThrow(
        'No branches found',
      );
    });

    it('should aggregate budget data when available', async () => {
      jest.spyOn(prismaService.client.branch, 'findMany').mockResolvedValue([
        { id: mockBranch1Id, name: 'Branch Alpha' },
        { id: mockBranch2Id, name: 'Branch Beta' },
      ] as any);

      jest
        .spyOn(service, 'getBranchMetrics')
        .mockResolvedValueOnce({
          branchId: mockBranch1Id,
          branchName: 'Branch Alpha',
          totalSales: 500000,
          totalCOGS: 175000,
          grossMargin: 325000,
          grossMarginPercent: 65,
          wastageCost: 20000,
          wastagePercent: 4,
          kdsSlaScore: 90,
          staffScore: 75,
          revenueTarget: 450000,
          revenueDelta: 50000,
          revenueDeltaPercent: 11.11,
          cogsTarget: 160000,
          cogsDelta: 15000,
          periodStart,
          periodEnd,
        } as any)
        .mockResolvedValueOnce({
          branchId: mockBranch2Id,
          branchName: 'Branch Beta',
          totalSales: 300000,
          totalCOGS: 120000,
          grossMargin: 180000,
          grossMarginPercent: 60,
          wastageCost: 15000,
          wastagePercent: 5,
          kdsSlaScore: 85,
          staffScore: 70,
          revenueTarget: 280000,
          revenueDelta: 20000,
          revenueDeltaPercent: 7.14,
          cogsTarget: 100000,
          cogsDelta: 20000,
          periodStart,
          periodEnd,
        } as any);

      const result = await service.getFranchiseSummary(mockOrgId, periodStart, periodEnd);

      expect(result.totalRevenueTarget).toBe(730000); // 450k + 280k
      expect(result.totalRevenueDelta).toBe(70000); // 50k + 20k
      expect(result.totalCogsTarget).toBe(260000); // 160k + 100k
      expect(result.totalCogsDelta).toBe(35000); // 15k + 20k
    });
  });

  describe('Consistency with canonical services', () => {
    it('should use ReconciliationService for COGS calculation', async () => {
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
      } as any);

      jest
        .spyOn(prismaService.client.order, 'findMany')
        .mockResolvedValue([{ total: 100000 }] as any);

      const reconcileSpy = jest
        .spyOn(reconciliationService, 'reconcile')
        .mockResolvedValue([{ theoreticalUsageCost: 35000 }] as any);

      jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({ totalCost: 0 } as any);
      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([]);
      jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([]);
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue(null);

      await service.getBranchMetrics(mockOrgId, mockBranch1Id, periodStart, periodEnd);

      expect(reconcileSpy).toHaveBeenCalledWith({
        orgId: mockOrgId,
        branchId: mockBranch1Id,
        startDate: periodStart,
        endDate: periodEnd,
      });
    });

    it('should use WastageService for wastage cost', async () => {
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
      } as any);

      jest.spyOn(prismaService.client.order, 'findMany').mockResolvedValue([]);
      jest.spyOn(reconciliationService, 'reconcile').mockResolvedValue([]);

      const wastageSpy = jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({
        totalQty: 10,
        totalCost: 25000,
        byReason: [],
        byUser: [],
      } as any);

      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([]);
      jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([]);
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue(null);

      const result = await service.getBranchMetrics(
        mockOrgId,
        mockBranch1Id,
        periodStart,
        periodEnd,
      );

      expect(wastageSpy).toHaveBeenCalledWith(mockOrgId, mockBranch1Id, periodStart, periodEnd);
      expect(result.wastageCost).toBe(25000);
    });

    it('should use WaiterMetricsService for staff score', async () => {
      jest.spyOn(prismaService.client.branch, 'findUnique').mockResolvedValue({
        id: mockBranch1Id,
        name: 'Branch Alpha',
      } as any);

      jest.spyOn(prismaService.client.order, 'findMany').mockResolvedValue([]);
      jest.spyOn(reconciliationService, 'reconcile').mockResolvedValue([]);
      jest.spyOn(wastageService, 'getWastageSummary').mockResolvedValue({ totalCost: 0 } as any);
      jest.spyOn(prismaService.client.kdsTicket, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.client.branchBudget, 'findUnique').mockResolvedValue(null);

      const waiterSpy = jest.spyOn(waiterMetricsService, 'getRankedWaiters').mockResolvedValue([
        { score: 0.9, rank: 1 },
        { score: 0.7, rank: 2 },
      ] as any);

      const result = await service.getBranchMetrics(
        mockOrgId,
        mockBranch1Id,
        periodStart,
        periodEnd,
      );

      expect(waiterSpy).toHaveBeenCalledWith({
        orgId: mockOrgId,
        branchId: mockBranch1Id,
        from: periodStart,
        to: periodEnd,
      });
      expect(result.staffScore).toBeGreaterThan(0);
    });
  });
});
