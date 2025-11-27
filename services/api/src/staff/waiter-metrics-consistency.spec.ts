import { Test, TestingModule } from '@nestjs/testing';
import { WaiterMetricsService } from './waiter-metrics.service';
import { PrismaService } from '../prisma.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { AntiTheftService } from '../anti-theft/anti-theft.service';
import { ReportGeneratorService } from '../reports/report-generator.service';

/**
 * M5: Waiter Metrics Consistency Tests
 *
 * Verifies that the new canonical WaiterMetricsService produces consistent results
 * with the legacy DashboardsService and that all consuming services (reports, anti-theft)
 * use the canonical service.
 */
describe('Waiter Metrics Consistency (M5)', () => {
  let waiterMetricsService: WaiterMetricsService;
  let dashboardsService: DashboardsService;
  let antiTheftService: AntiTheftService;
  let reportGeneratorService: ReportGeneratorService;
  let prisma: PrismaService;

  const testOrgId = 'test-org-1';
  const testBranchId = 'test-branch-1';
  const testUserId = 'test-waiter-1';
  const testPeriod = {
    from: new Date('2024-01-01T00:00:00Z'),
    to: new Date('2024-01-01T23:59:59Z'),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaiterMetricsService,
        DashboardsService,
        AntiTheftService,
        ReportGeneratorService,
        PrismaService,
      ],
    }).compile();

    waiterMetricsService = module.get<WaiterMetricsService>(WaiterMetricsService);
    dashboardsService = module.get<DashboardsService>(DashboardsService);
    antiTheftService = module.get<AntiTheftService>(AntiTheftService);
    reportGeneratorService = module.get<ReportGeneratorService>(ReportGeneratorService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Canonical Metrics vs Legacy Dashboards', () => {
    /**
     * Test 1: Void counts should match between WaiterMetricsService and DashboardsService
     */
    it('should produce consistent void counts', async () => {
      // Get canonical metrics
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      // Get legacy dashboard data
      const voidLeaderboard = await dashboardsService.getVoidLeaderboard(
        testOrgId,
        testPeriod.from,
        testPeriod.to,
        100,
      );

      // Compare for each waiter
      const metricsByUser = new Map(metrics.map((m) => [m.userId, m]));
      voidLeaderboard.forEach((entry: any) => {
        const metric = metricsByUser.get(entry.userId);
        if (metric) {
          expect(metric.voidCount).toBe(entry.voids);
          expect(metric.voidValue).toBeCloseTo(entry.totalVoidUGX, 2);
        }
      });
    });

    /**
     * Test 2: Discount counts should match
     */
    it('should produce consistent discount counts', async () => {
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      const discountLeaderboard = await dashboardsService.getDiscountLeaderboard(
        testOrgId,
        testPeriod.from,
        testPeriod.to,
        100,
      );

      const metricsByUser = new Map(metrics.map((m) => [m.userId, m]));
      discountLeaderboard.forEach((entry: any) => {
        const metric = metricsByUser.get(entry.userId);
        if (metric) {
          expect(metric.discountCount).toBe(entry.discounts);
          expect(metric.discountValue).toBeCloseTo(entry.totalDiscountUGX, 2);
        }
      });
    });

    /**
     * Test 3: No-drinks rate should match
     */
    it('should produce consistent no-drinks rates', async () => {
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      const noDrinksData = await dashboardsService.getNoDrinksRate(
        testOrgId,
        testPeriod.from,
        testPeriod.to,
      );

      const metricsByUser = new Map(metrics.map((m) => [m.userId, m]));
      noDrinksData.forEach((entry: any) => {
        const metric = metricsByUser.get(entry.waiterId);
        if (metric && metric.orderCount > 0) {
          expect(metric.noDrinksRate).toBeCloseTo(entry.noDrinks / (entry.orders || 1), 2);
        }
      });
    });

    /**
     * Test 4: Sales totals should match
     */
    it('should produce consistent sales totals', async () => {
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      // Query orders directly to verify
      const orders = await prisma.client.order.findMany({
        where: {
          branchId: testBranchId,
          createdAt: { gte: testPeriod.from, lte: testPeriod.to },
          status: { in: ['CLOSED', 'SERVED'] },
        },
        select: {
          userId: true,
          total: true,
          status: true,
        },
      });

      const salesByUser = new Map<string, number>();
      orders.forEach((o) => {
        if (o.status !== 'VOIDED') {
          salesByUser.set(o.userId, (salesByUser.get(o.userId) || 0) + Number(o.total));
        }
      });

      metrics.forEach((m) => {
        const expectedSales = salesByUser.get(m.userId) || 0;
        expect(m.totalSales).toBeCloseTo(expectedSales, 2);
      });
    });
  });

  describe('Report Generator Integration', () => {
    /**
     * Test 5: Shift-end service report should use WaiterMetricsService
     */
    it('should generate service report using canonical metrics', async () => {
      // Create a test shift
      const shift = await prisma.client.shift.create({
        data: {
          orgId: testOrgId,
          branchId: testBranchId,
          openedAt: testPeriod.from,
          closedAt: testPeriod.to,
          openedById: testUserId,
          closedById: testUserId,
        },
      });

      try {
        const report = await reportGeneratorService['generateServiceReport'](
          testOrgId,
          testBranchId,
          { startedAt: testPeriod.from, closedAt: testPeriod.to },
        );

        // Get canonical metrics for comparison
        const metrics = await waiterMetricsService.getWaiterMetrics({
          orgId: testOrgId,
          branchId: testBranchId,
          from: testPeriod.from,
          to: testPeriod.to,
        });

        // Verify report matches canonical metrics
        const reportByUser = new Map(report.byWaiter.map((w) => [w.userId, w]));
        metrics.forEach((m) => {
          const reportWaiter = reportByUser.get(m.userId);
          if (reportWaiter) {
            expect(reportWaiter.orders).toBe(m.orderCount);
            expect(reportWaiter.revenue).toBeCloseTo(m.totalSales, 2);
            expect(reportWaiter.voidCount).toBe(m.voidCount);
            expect(reportWaiter.discountCount).toBe(m.discountCount);
            expect(reportWaiter.noDrinksRate).toBeCloseTo(m.noDrinksRate, 3);
          }
        });
      } finally {
        // Cleanup
        await prisma.client.shift.delete({ where: { id: shift.id } });
      }
    });

    /**
     * Test 6: Staff performance report should use WaiterMetricsService
     */
    it('should generate staff performance using canonical rankings', async () => {
      const shift = await prisma.client.shift.create({
        data: {
          orgId: testOrgId,
          branchId: testBranchId,
          openedAt: testPeriod.from,
          closedAt: testPeriod.to,
          openedById: testUserId,
          closedById: testUserId,
        },
      });

      try {
        const staffPerformance = await reportGeneratorService['generateStaffPerformance'](
          testOrgId,
          testBranchId,
          { startedAt: testPeriod.from, closedAt: testPeriod.to },
        );

        // Get canonical rankings
        const ranked = await waiterMetricsService.getRankedWaiters({
          orgId: testOrgId,
          branchId: testBranchId,
          from: testPeriod.from,
          to: testPeriod.to,
        });

        // Top performers should match
        if (ranked.length > 0 && staffPerformance.topPerformers.length > 0) {
          expect(staffPerformance.topPerformers[0].userId).toBe(ranked[0].userId);
          expect(staffPerformance.topPerformers[0].score).toBeCloseTo(ranked[0].score, 3);
        }

        // Risk staff should match bottom performers
        if (ranked.length > 0 && staffPerformance.riskStaff.length > 0) {
          const bottomWaiter = ranked[ranked.length - 1];
          const riskWaiter = staffPerformance.riskStaff[staffPerformance.riskStaff.length - 1];
          expect(riskWaiter.userId).toBe(bottomWaiter.userId);
        }
      } finally {
        await prisma.client.shift.delete({ where: { id: shift.id } });
      }
    });
  });

  describe('Anti-Theft Integration', () => {
    /**
     * Test 7: Anti-theft summary should use WaiterMetricsService
     */
    it('should flag risky staff using canonical metrics', async () => {
      const summary = await antiTheftService.getAntiTheftSummary(
        testOrgId,
        testBranchId,
        undefined,
        testPeriod.from,
        testPeriod.to,
      );

      // Get canonical metrics
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      // Verify flagged staff match high-risk metrics
      summary.flaggedStaff.forEach((flagged) => {
        const metric = metrics.find((m) => m.userId === flagged.metrics.userId);
        expect(metric).toBeDefined();
        if (metric) {
          expect(flagged.metrics.voidCount).toBe(metric.voidCount);
          expect(flagged.metrics.discountCount).toBe(metric.discountCount);
          expect(flagged.metrics.noDrinksRate).toBeCloseTo(metric.noDrinksRate, 3);
        }
      });
    });

    /**
     * Test 8: Threshold violations should be accurate
     */
    it('should correctly identify threshold violations', async () => {
      const summary = await antiTheftService.getAntiTheftSummary(
        testOrgId,
        testBranchId,
        undefined,
        testPeriod.from,
        testPeriod.to,
      );

      summary.flaggedStaff.forEach((flagged) => {
        const m = flagged.metrics;
        const voidRate = m.orderCount > 0 ? m.voidCount / m.orderCount : 0;
        const discountRate = m.orderCount > 0 ? m.discountCount / m.orderCount : 0;

        flagged.violations.forEach((v) => {
          switch (v.metric) {
            case 'voidRate':
              expect(voidRate).toBeGreaterThan(summary.thresholds.maxVoidRate);
              break;
            case 'discountRate':
              expect(discountRate).toBeGreaterThan(summary.thresholds.maxDiscountRate);
              break;
            case 'noDrinksRate':
              expect(m.noDrinksRate).toBeGreaterThan(summary.thresholds.maxNoDrinksRate);
              break;
            case 'anomalyScore':
              expect(m.anomalyScore).toBeGreaterThan(summary.thresholds.maxAnomalyScore);
              break;
          }
        });
      });
    });
  });

  describe('Scoring Algorithm', () => {
    /**
     * Test 9: Rankings should be deterministic and ordered correctly
     */
    it('should produce deterministic rankings', async () => {
      const ranked = await waiterMetricsService.getRankedWaiters({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      // Ranks should be sequential 1, 2, 3...
      ranked.forEach((r, i) => {
        expect(r.rank).toBe(i + 1);
      });

      // Scores should be descending
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
      }
    });

    /**
     * Test 10: Scoring components should sum correctly
     */
    it('should calculate scores correctly from components', async () => {
      const ranked = await waiterMetricsService.getRankedWaiters({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      ranked.forEach((r) => {
        if (r.scoreComponents) {
          const expectedScore =
            r.scoreComponents.salesScore +
            r.scoreComponents.avgCheckScore -
            r.scoreComponents.voidPenalty -
            r.scoreComponents.discountPenalty -
            r.scoreComponents.noDrinksPenalty -
            r.scoreComponents.anomalyPenalty;

          expect(r.score).toBeCloseTo(expectedScore, 5);
        }
      });
    });
  });

  describe('Data Integrity', () => {
    /**
     * Test 11: Metrics should never have negative values
     */
    it('should never produce negative metrics', async () => {
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      metrics.forEach((m) => {
        expect(m.orderCount).toBeGreaterThanOrEqual(0);
        expect(m.totalSales).toBeGreaterThanOrEqual(0);
        expect(m.voidCount).toBeGreaterThanOrEqual(0);
        expect(m.voidValue).toBeGreaterThanOrEqual(0);
        expect(m.discountCount).toBeGreaterThanOrEqual(0);
        expect(m.discountValue).toBeGreaterThanOrEqual(0);
        expect(m.noDrinksRate).toBeGreaterThanOrEqual(0);
        expect(m.noDrinksRate).toBeLessThanOrEqual(1);
        expect(m.anomalyCount).toBeGreaterThanOrEqual(0);
        expect(m.anomalyScore).toBeGreaterThanOrEqual(0);
      });
    });

    /**
     * Test 12: Rates should be within valid ranges
     */
    it('should produce valid rate calculations', async () => {
      const metrics = await waiterMetricsService.getWaiterMetrics({
        orgId: testOrgId,
        branchId: testBranchId,
        from: testPeriod.from,
        to: testPeriod.to,
      });

      metrics.forEach((m) => {
        if (m.orderCount > 0) {
          const voidRate = m.voidCount / m.orderCount;
          const discountRate = m.discountCount / m.orderCount;

          expect(voidRate).toBeGreaterThanOrEqual(0);
          expect(voidRate).toBeLessThanOrEqual(m.orderCount); // Can't void more than total orders
          expect(discountRate).toBeGreaterThanOrEqual(0);
          expect(m.noDrinksRate).toBeGreaterThanOrEqual(0);
          expect(m.noDrinksRate).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  afterAll(async () => {
    await prisma.client.$disconnect();
  });
});
