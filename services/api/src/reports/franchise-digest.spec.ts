import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../prisma.service';
import { WaiterMetricsService } from '../staff/waiter-metrics.service';
import { FranchiseOverviewService } from '../franchise/franchise-overview.service';

/**
 * M6: Franchise Digest Consistency Tests
 *
 * Ensures franchise digest generation uses canonical FranchiseOverviewService
 * and produces consistent results with franchise API endpoints.
 */
describe('ReportGeneratorService - Franchise Digest (M6)', () => {
  let service: ReportGeneratorService;
  let franchiseOverviewService: FranchiseOverviewService;
  let prismaService: PrismaService;

  const mockOrgId = 'org-digest-test';
  const periodStart = new Date('2024-01-01T00:00:00Z');
  const periodEnd = new Date('2024-01-31T23:59:59Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              anomalyEvent: {
                count: jest.fn(),
              },
            },
          },
        },
        {
          provide: WaiterMetricsService,
          useValue: {},
        },
        {
          provide: FranchiseOverviewService,
          useValue: {
            getFranchiseSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportGeneratorService>(ReportGeneratorService);
    franchiseOverviewService = module.get<FranchiseOverviewService>(FranchiseOverviewService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('generateFranchiseDigest', () => {
    it('should generate digest using FranchiseOverviewService', async () => {
      const mockSummary = {
        totalSales: 800000,
        totalCOGS: 280000,
        totalGrossMargin: 520000,
        totalWastageCost: 35000,
        avgGrossMarginPercent: 65,
        avgWastagePercent: 4.375,
        avgKdsSlaScore: 92,
        avgStaffScore: 78,
        branches: [
          {
            branchId: 'branch-001',
            branchName: 'Branch Alpha',
            totalSales: 500000,
            orderCount: 100,
            totalCOGS: 175000,
            grossMargin: 325000,
            grossMarginPercent: 65,
            wastageCost: 20000,
            wastagePercent: 4,
            kdsSlaScore: 95,
            staffScore: 80,
            revenueTarget: 450000,
            revenueDelta: 50000,
            revenueDeltaPercent: 11.11,
            cogsTarget: 150000,
            cogsDelta: 25000,
          },
          {
            branchId: 'branch-002',
            branchName: 'Branch Beta',
            totalSales: 300000,
            orderCount: 60,
            totalCOGS: 105000,
            grossMargin: 195000,
            grossMarginPercent: 65,
            wastageCost: 15000,
            wastagePercent: 5,
            kdsSlaScore: 89,
            staffScore: 76,
            revenueTarget: 280000,
            revenueDelta: 20000,
            revenueDeltaPercent: 7.14,
            cogsTarget: 100000,
            cogsDelta: 5000,
          },
        ],
        periodStart,
        periodEnd,
        totalRevenueTarget: 730000,
        totalRevenueDelta: 70000,
        totalCogsTarget: 250000,
        totalCogsDelta: 30000,
      };

      jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue(mockSummary as any);
      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(5);

      const result = await service.generateFranchiseDigest(mockOrgId, periodStart, periodEnd);

      // Verify digest structure
      expect(result.orgId).toBe(mockOrgId);
      expect(result.period.type).toBe('MONTHLY');
      expect(result.period.startDate).toEqual(periodStart);
      expect(result.period.endDate).toEqual(periodEnd);

      // Verify summary aggregations
      expect(result.summary.branches).toBe(2);
      expect(result.summary.totalRevenue).toBe(800000);
      expect(result.summary.totalOrders).toBe(160); // 100 + 60
      expect(result.summary.averageRevenuePerBranch).toBe(400000); // 800k / 2

      // Verify totals
      expect(result.totals.revenue).toBe(800000);
      expect(result.totals.cost).toBe(280000);
      expect(result.totals.grossMargin).toBe(520000);
      expect(result.totals.wastage).toBe(35000);
      expect(result.totals.anomalies).toBe(10); // 5 per branch (called twice)

      // Verify per-branch data
      expect(result.byBranch).toHaveLength(2);
      expect(result.byBranch[0].branchId).toBe('branch-001');
      expect(result.byBranch[0].revenue).toBe(500000);
      expect(result.byBranch[0].wastePercentage).toBe(4);
      expect(result.byBranch[0].slaPercentage).toBe(95);

      // Verify budget vs actual
      expect(result.byBranch[0].budgetVsActual.budget).toBe(450000);
      expect(result.byBranch[0].budgetVsActual.actual).toBe(500000);
      expect(result.byBranch[0].budgetVsActual.variance).toBe(50000);

      // Verify rankings
      expect(result.rankings.byRevenue).toEqual(['branch-001', 'branch-002']);
      expect(result.rankings.byWaste).toEqual(['branch-001', 'branch-002']); // Lower waste first
    });

    it('should handle weekly period correctly', async () => {
      const weekStart = new Date('2024-01-01T00:00:00Z');
      const weekEnd = new Date('2024-01-07T23:59:59Z');

      const mockSummary = {
        totalSales: 200000,
        totalCOGS: 70000,
        totalGrossMargin: 130000,
        totalWastageCost: 8000,
        avgGrossMarginPercent: 65,
        avgWastagePercent: 4,
        avgKdsSlaScore: 90,
        avgStaffScore: 75,
        branches: [
          {
            branchId: 'branch-001',
            branchName: 'Branch Alpha',
            totalSales: 200000,
            orderCount: 50,
            totalCOGS: 70000,
            grossMargin: 130000,
            grossMarginPercent: 65,
            wastageCost: 8000,
            wastagePercent: 4,
            kdsSlaScore: 90,
            staffScore: 75,
          },
        ],
        periodStart: weekStart,
        periodEnd: weekEnd,
      };

      jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue(mockSummary as any);
      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(2);

      const result = await service.generateFranchiseDigest(mockOrgId, weekStart, weekEnd);

      expect(result.period.type).toBe('WEEKLY');
    });

    it('should rank branches correctly by different metrics', async () => {
      const mockSummary = {
        totalSales: 1000000,
        totalCOGS: 350000,
        totalGrossMargin: 650000,
        totalWastageCost: 50000,
        avgGrossMarginPercent: 65,
        avgWastagePercent: 5,
        avgKdsSlaScore: 88,
        avgStaffScore: 70,
        branches: [
          {
            branchId: 'branch-001',
            branchName: 'Alpha',
            totalSales: 500000, // Highest revenue
            grossMarginPercent: 60, // Lowest margin
            wastagePercent: 6, // Highest waste
            kdsSlaScore: 85, // Lowest SLA
            orderCount: 100,
            totalCOGS: 200000,
            grossMargin: 300000,
            wastageCost: 30000,
            staffScore: 70,
          },
          {
            branchId: 'branch-002',
            branchName: 'Beta',
            totalSales: 300000, // Mid revenue
            grossMarginPercent: 70, // Highest margin
            wastagePercent: 4, // Lowest waste (best)
            kdsSlaScore: 95, // Highest SLA
            orderCount: 60,
            totalCOGS: 90000,
            grossMargin: 210000,
            wastageCost: 12000,
            staffScore: 80,
          },
          {
            branchId: 'branch-003',
            branchName: 'Gamma',
            totalSales: 200000, // Lowest revenue
            grossMarginPercent: 65, // Mid margin
            wastagePercent: 5, // Mid waste
            kdsSlaScore: 90, // Mid SLA
            orderCount: 40,
            totalCOGS: 70000,
            grossMargin: 130000,
            wastageCost: 10000,
            staffScore: 75,
          },
        ],
        periodStart,
        periodEnd,
      };

      jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue(mockSummary as any);
      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(0);

      const result = await service.generateFranchiseDigest(mockOrgId, periodStart, periodEnd);

      // By revenue: Alpha > Beta > Gamma
      expect(result.rankings.byRevenue).toEqual(['branch-001', 'branch-002', 'branch-003']);

      // By margin: Beta > Gamma > Alpha
      expect(result.rankings.byMargin).toEqual(['branch-002', 'branch-003', 'branch-001']);

      // By SLA: Beta > Gamma > Alpha
      expect(result.rankings.bySLA).toEqual(['branch-002', 'branch-003', 'branch-001']);

      // By waste (lower is better): Beta > Gamma > Alpha
      expect(result.rankings.byWaste).toEqual(['branch-002', 'branch-003', 'branch-001']);
    });

    it('should handle branches without budgets', async () => {
      const mockSummary = {
        totalSales: 500000,
        totalCOGS: 175000,
        totalGrossMargin: 325000,
        totalWastageCost: 20000,
        avgGrossMarginPercent: 65,
        avgWastagePercent: 4,
        avgKdsSlaScore: 90,
        avgStaffScore: 75,
        branches: [
          {
            branchId: 'branch-001',
            branchName: 'Branch Alpha',
            totalSales: 500000,
            orderCount: 100,
            totalCOGS: 175000,
            grossMargin: 325000,
            grossMarginPercent: 65,
            wastageCost: 20000,
            wastagePercent: 4,
            kdsSlaScore: 90,
            staffScore: 75,
            // No budget targets
          },
        ],
        periodStart,
        periodEnd,
      };

      jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue(mockSummary as any);
      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(0);

      const result = await service.generateFranchiseDigest(mockOrgId, periodStart, periodEnd);

      expect(result.byBranch[0].budgetVsActual.budget).toBe(0);
      expect(result.byBranch[0].budgetVsActual.actual).toBe(500000);
      expect(result.byBranch[0].budgetVsActual.variance).toBe(0);
    });
  });

  describe('Digest consistency with FranchiseOverviewService', () => {
    it('should call FranchiseOverviewService with correct parameters', async () => {
      const getSummarySpy = jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue({
          totalSales: 100000,
          totalCOGS: 35000,
          totalGrossMargin: 65000,
          totalWastageCost: 4000,
          avgGrossMarginPercent: 65,
          avgWastagePercent: 4,
          avgKdsSlaScore: 90,
          avgStaffScore: 75,
          branches: [],
          periodStart,
          periodEnd,
        } as any);

      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(0);

      await service.generateFranchiseDigest(mockOrgId, periodStart, periodEnd);

      expect(getSummarySpy).toHaveBeenCalledWith(mockOrgId, periodStart, periodEnd);
      expect(getSummarySpy).toHaveBeenCalledTimes(1);
    });

    it('should maintain consistency: digest totals = sum of branch metrics', async () => {
      const mockSummary = {
        totalSales: 800000,
        totalCOGS: 280000,
        totalGrossMargin: 520000,
        totalWastageCost: 35000,
        avgGrossMarginPercent: 65,
        avgWastagePercent: 4.375,
        avgKdsSlaScore: 92,
        avgStaffScore: 78,
        branches: [
          {
            branchId: 'branch-001',
            branchName: 'Alpha',
            totalSales: 500000,
            orderCount: 100,
            totalCOGS: 175000,
            grossMargin: 325000,
            grossMarginPercent: 65,
            wastageCost: 20000,
            wastagePercent: 4,
            kdsSlaScore: 95,
            staffScore: 80,
          },
          {
            branchId: 'branch-002',
            branchName: 'Beta',
            totalSales: 300000,
            orderCount: 60,
            totalCOGS: 105000,
            grossMargin: 195000,
            grossMarginPercent: 65,
            wastageCost: 15000,
            wastagePercent: 5,
            kdsSlaScore: 89,
            staffScore: 76,
          },
        ],
        periodStart,
        periodEnd,
      };

      jest
        .spyOn(franchiseOverviewService, 'getFranchiseSummary')
        .mockResolvedValue(mockSummary as any);
      jest.spyOn(prismaService.client.anomalyEvent, 'count').mockResolvedValue(0);

      const result = await service.generateFranchiseDigest(mockOrgId, periodStart, periodEnd);

      // Verify totals = sum of branches
      const sumRevenue = result.byBranch.reduce((sum, b) => sum + b.revenue, 0);
      expect(result.totals.revenue).toBe(sumRevenue);

      const sumOrders = result.byBranch.reduce((sum, b) => sum + b.orders, 0);
      expect(result.summary.totalOrders).toBe(sumOrders);

      // Verify franchise-level totals match summary
      expect(result.totals.revenue).toBe(mockSummary.totalSales);
      expect(result.totals.cost).toBe(mockSummary.totalCOGS);
      expect(result.totals.grossMargin).toBe(mockSummary.totalGrossMargin);
      expect(result.totals.wastage).toBe(mockSummary.totalWastageCost);
    });
  });
});
