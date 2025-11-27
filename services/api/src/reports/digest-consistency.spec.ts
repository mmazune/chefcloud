import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@chefcloud/db';
import { ReportGeneratorService } from './report-generator.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { KdsService } from '../kds/kds.service';
import { WastageService } from '../wastage/wastage.service';

/**
 * M4: Data Consistency Tests
 *
 * These tests verify that digest reports produce metrics consistent with
 * the canonical APIs that power the dashboard, reconciliation, anti-theft,
 * and KDS modules.
 */
describe('Digest Consistency Tests', () => {
  let prisma: PrismaService;
  let reportGenerator: ReportGeneratorService;
  let dashboardsService: DashboardsService;
  let reconciliationService: ReconciliationService;
  let kdsService: KdsService;
  let wastageService: WastageService;

  // Test fixtures
  let testOrgId: string;
  let testBranchId: string;
  let testShiftId: string;
  let testWaiterId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        ReportGeneratorService,
        DashboardsService,
        ReconciliationService,
        KdsService,
        WastageService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    reportGenerator = module.get<ReportGeneratorService>(ReportGeneratorService);
    dashboardsService = module.get<DashboardsService>(DashboardsService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    kdsService = module.get<KdsService>(KdsService);
    wastageService = module.get<WastageService>(WastageService);
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.$executeRaw`DELETE FROM orders WHERE org_id IN (SELECT id FROM orgs WHERE slug LIKE 'test-digest-%')`;
    await prisma.$executeRaw`DELETE FROM branches WHERE org_id IN (SELECT id FROM orgs WHERE slug LIKE 'test-digest-%')`;
    await prisma.$executeRaw`DELETE FROM orgs WHERE slug LIKE 'test-digest-%'`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Scenario A: Single Shift Consistency
   *
   * Verifies that a shift-end report matches the canonical APIs:
   * - Sales API: totalSales, voidCount, voidValue, discountValue
   * - Reconciliation API: wastageCost, variance
   * - Anti-theft API: per-waiter metrics
   * - KDS API: ticket counts, SLA distribution
   */
  describe('Scenario A: Single Shift Consistency', () => {
    beforeEach(async () => {
      // Seed realistic single-shift data
      await seedSingleShiftData();
    });

    it('should match sales metrics from Sales API', async () => {
      // Generate shift-end report
      const shiftReport = await reportGenerator.generateShiftEndReport(
        testOrgId,
        testBranchId,
        testShiftId,
      );

      // Query canonical Sales API
      const salesMetrics = await dashboardsService.getSalesMetrics(testBranchId, {
        shiftId: testShiftId,
      });

      // Assertions
      expect(shiftReport.sales.totalSales).toBeCloseTo(salesMetrics.totalSales, 2);
      expect(shiftReport.sales.totalOrders).toBe(salesMetrics.orderCount);

      // Void metrics
      const voidMetrics = await dashboardsService.getVoidLeaderboard(testBranchId, {
        shiftId: testShiftId,
      });
      const totalVoidCount = voidMetrics.reduce((sum, v) => sum + v.voidCount, 0);
      const totalVoidValue = voidMetrics.reduce((sum, v) => sum + Number(v.voidValue), 0);

      expect(shiftReport.service.totalVoidCount).toBe(totalVoidCount);
      expect(shiftReport.service.totalVoidValue).toBeCloseTo(totalVoidValue, 2);

      // Discount metrics
      const discountMetrics = await dashboardsService.getDiscountLeaderboard(testBranchId, {
        shiftId: testShiftId,
      });
      const totalDiscountValue = discountMetrics.reduce(
        (sum, d) => sum + Number(d.totalDiscountValue),
        0,
      );

      expect(shiftReport.service.totalDiscountValue).toBeCloseTo(totalDiscountValue, 2);
    });

    it('should match reconciliation metrics from Reconciliation API', async () => {
      const shiftReport = await reportGenerator.generateShiftEndReport(
        testOrgId,
        testBranchId,
        testShiftId,
      );

      // Query canonical Reconciliation API
      const reconciliation = await reconciliationService.getShiftReconciliation(testShiftId);

      // Assertions
      expect(shiftReport.stock.totalWastageValue).toBeCloseTo(
        Number(reconciliation.wastage.totalCost),
        2,
      );
      expect(shiftReport.stock.totalVarianceValue).toBeCloseTo(
        Number(reconciliation.variance.totalValue),
        2,
      );
    });

    it('should match waiter metrics from Anti-theft API', async () => {
      const shiftReport = await reportGenerator.generateShiftEndReport(
        testOrgId,
        testBranchId,
        testShiftId,
      );

      // Query canonical waiter metrics
      const waiterMetrics = await dashboardsService.getWaiterPerformance(testBranchId, {
        shiftId: testShiftId,
      });

      // Find test waiter in both datasets
      const reportWaiter = shiftReport.service.waiterMetrics.find(
        (w) => w.waiterId === testWaiterId,
      );
      const apiWaiter = waiterMetrics.find((w) => w.userId === testWaiterId);

      expect(reportWaiter).toBeDefined();
      expect(apiWaiter).toBeDefined();

      // Assertions
      expect(reportWaiter!.totalSales).toBeCloseTo(Number(apiWaiter!.totalSales), 2);
      expect(reportWaiter!.orderCount).toBe(apiWaiter!.orderCount);
      expect(reportWaiter!.voidCount).toBe(apiWaiter!.voidCount);
      expect(reportWaiter!.discountCount).toBe(apiWaiter!.discountCount);
    });

    it('should match KDS metrics from KDS API', async () => {
      const shiftReport = await reportGenerator.generateShiftEndReport(
        testOrgId,
        testBranchId,
        testShiftId,
      );

      // Query canonical KDS API
      const kdsMetrics = await kdsService.getShiftSlaMetrics(testShiftId);

      // Assertions
      expect(shiftReport.kdsMetrics.totalTickets).toBe(kdsMetrics.totalTickets);
      expect(shiftReport.kdsMetrics.slaMetrics.greenCount).toBe(kdsMetrics.sla.greenCount);
      expect(shiftReport.kdsMetrics.slaMetrics.orangeCount).toBe(kdsMetrics.sla.orangeCount);
      expect(shiftReport.kdsMetrics.slaMetrics.redCount).toBe(kdsMetrics.sla.redCount);

      // Percentages should match within rounding tolerance
      expect(shiftReport.kdsMetrics.slaMetrics.greenPct).toBeCloseTo(kdsMetrics.sla.greenPct, 1);
      expect(shiftReport.kdsMetrics.slaMetrics.orangePct).toBeCloseTo(kdsMetrics.sla.orangePct, 1);
      expect(shiftReport.kdsMetrics.slaMetrics.redPct).toBeCloseTo(kdsMetrics.sla.redPct, 1);
    });
  });

  /**
   * Scenario B: Period Digest Consistency
   *
   * Verifies that period digests (DAILY/WEEKLY/MONTHLY) match analytics APIs
   * when aggregating data across multiple days.
   */
  describe('Scenario B: Period Digest Consistency', () => {
    const startDate = new Date('2025-11-15T00:00:00Z');
    const endDate = new Date('2025-11-17T23:59:59Z');

    beforeEach(async () => {
      // Seed multi-day data
      await seedMultiDayData(startDate, endDate);
    });

    it('should match analytics API for period aggregations', async () => {
      // Generate period digest
      const periodDigest = await reportGenerator.generatePeriodDigest(
        testOrgId,
        testBranchId,
        startDate,
        endDate,
      );

      // Query canonical analytics APIs for same range
      const salesMetrics = await dashboardsService.getSalesMetrics(testBranchId, {
        startDate,
        endDate,
      });

      const wastageMetrics = await wastageService.getWastageSummary(testBranchId, {
        startDate,
        endDate,
      });

      // Assertions
      expect(periodDigest.totalSales).toBeCloseTo(salesMetrics.totalSales, 2);
      expect(periodDigest.orderCount).toBe(salesMetrics.orderCount);
      expect(periodDigest.avgOrderValue).toBeCloseTo(salesMetrics.avgOrderValue, 2);

      expect(periodDigest.wastageCost).toBeCloseTo(Number(wastageMetrics.totalCost), 2);
    });
  });

  // =========================================================================
  // Test Data Seeding Helpers
  // =========================================================================

  async function seedSingleShiftData() {
    // Create org
    const org = await prisma.org.create({
      data: {
        name: 'Test Digest Org',
        slug: `test-digest-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    // Create branch
    const branch = await prisma.branch.create({
      data: {
        orgId: testOrgId,
        name: 'Main Branch',
        slug: 'main',
        timezone: 'Africa/Kampala',
      },
    });
    testBranchId = branch.id;

    // Create waiter
    const waiter = await prisma.user.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        email: `waiter-${Date.now()}@test.local`,
        firstName: 'Test',
        lastName: 'Waiter',
        roleLevel: 'L2',
      },
    });
    testWaiterId = waiter.id;

    // Create shift
    const shift = await prisma.shift.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        openedById: testWaiterId,
        openedAt: new Date('2025-11-18T08:00:00Z'),
        closedAt: new Date('2025-11-18T20:00:00Z'),
        closedById: testWaiterId,
        status: 'CLOSED',
      },
    });
    testShiftId = shift.id;

    // Create menu items
    const category = await prisma.menuCategory.create({
      data: {
        orgId: testOrgId,
        name: 'Main Course',
        slug: 'main-course',
        displayOrder: 1,
      },
    });

    const menuItem1 = await prisma.menuItem.create({
      data: {
        orgId: testOrgId,
        categoryId: category.id,
        name: 'Burger',
        slug: 'burger',
        price: 15000,
      },
    });

    const menuItem2 = await prisma.menuItem.create({
      data: {
        orgId: testOrgId,
        categoryId: category.id,
        name: 'Pizza',
        slug: 'pizza',
        price: 25000,
      },
    });

    // Create orders (plain, with discount, with void)
    // Order 1: Plain order
    const order1 = await prisma.order.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        userId: testWaiterId,
        shiftId: testShiftId,
        orderNumber: 'ORD-001',
        status: 'COMPLETED',
        subtotal: 15000,
        tax: 2700,
        total: 17700,
        createdAt: new Date('2025-11-18T09:00:00Z'),
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        menuItemId: menuItem1.id,
        quantity: 1,
        unitPrice: 15000,
        subtotal: 15000,
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order1.id,
        amount: 17700,
        method: 'CASH',
        status: 'COMPLETED',
      },
    });

    // Order 2: With discount
    const order2 = await prisma.order.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        userId: testWaiterId,
        shiftId: testShiftId,
        orderNumber: 'ORD-002',
        status: 'COMPLETED',
        subtotal: 25000,
        discountAmount: 5000,
        tax: 3600,
        total: 23600,
        createdAt: new Date('2025-11-18T10:00:00Z'),
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order2.id,
        menuItemId: menuItem2.id,
        quantity: 1,
        unitPrice: 25000,
        subtotal: 25000,
      },
    });

    await prisma.discount.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        orderId: order2.id,
        createdById: testWaiterId,
        discountType: 'PERCENTAGE',
        discountValue: 20,
        amountDiscounted: 5000,
        reason: 'Loyalty discount',
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order2.id,
        amount: 23600,
        method: 'CARD',
        status: 'COMPLETED',
      },
    });

    // Order 3: Voided
    const order3 = await prisma.order.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        userId: testWaiterId,
        shiftId: testShiftId,
        orderNumber: 'ORD-003',
        status: 'VOIDED',
        subtotal: 15000,
        tax: 2700,
        total: 17700,
        voidedAt: new Date('2025-11-18T11:00:00Z'),
        createdAt: new Date('2025-11-18T10:45:00Z'),
      },
    });

    await prisma.auditEvent.create({
      data: {
        orgId: testOrgId,
        userId: testWaiterId,
        branchId: testBranchId,
        entityType: 'ORDER',
        entityId: order3.id,
        action: 'VOID',
        metadata: { reason: 'Customer cancelled' },
      },
    });

    // Create KDS tickets with varied durations
    await prisma.kdsTicket.create({
      data: {
        orgId: testOrgId,
        orderId: order1.id,
        station: 'KITCHEN',
        items: [{ name: 'Burger', quantity: 1 }],
        status: 'COMPLETED',
        sentAt: new Date('2025-11-18T09:00:00Z'),
        readyAt: new Date('2025-11-18T09:03:00Z'), // 3 min - GREEN
      },
    });

    await prisma.kdsTicket.create({
      data: {
        orgId: testOrgId,
        orderId: order2.id,
        station: 'KITCHEN',
        items: [{ name: 'Pizza', quantity: 1 }],
        status: 'COMPLETED',
        sentAt: new Date('2025-11-18T10:00:00Z'),
        readyAt: new Date('2025-11-18T10:07:00Z'), // 7 min - ORANGE
      },
    });

    // Create wastage records
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        orgId: testOrgId,
        name: 'Tomatoes',
        unit: 'kg',
        category: 'PRODUCE',
        reorderLevel: 10,
        par: 50,
      },
    });

    await prisma.wastage.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        itemId: inventoryItem.id,
        shiftId: testShiftId,
        userId: testWaiterId,
        qty: 2.5,
        reason: 'Spoilage',
        createdAt: new Date('2025-11-18T15:00:00Z'),
      },
    });

    // Create stock batches for low stock detection
    await prisma.stockBatch.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        itemId: inventoryItem.id,
        batchNumber: 'BATCH-001',
        initialQty: 100,
        remainingQty: 5, // Below reorder level
        unitCost: 5000,
      },
    });
  }

  async function seedMultiDayData(startDate: Date, endDate: Date) {
    // Create org and branch
    const org = await prisma.org.create({
      data: {
        name: 'Multi-Day Test Org',
        slug: `test-digest-multi-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    const branch = await prisma.branch.create({
      data: {
        orgId: testOrgId,
        name: 'Main Branch',
        slug: 'main',
        timezone: 'Africa/Kampala',
      },
    });
    testBranchId = branch.id;

    const waiter = await prisma.user.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        email: `waiter-multi-${Date.now()}@test.local`,
        firstName: 'Multi',
        lastName: 'Day',
        roleLevel: 'L2',
      },
    });

    // Create category and items
    const category = await prisma.menuCategory.create({
      data: {
        orgId: testOrgId,
        name: 'Beverages',
        slug: 'beverages',
        displayOrder: 1,
      },
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        orgId: testOrgId,
        categoryId: category.id,
        name: 'Coffee',
        slug: 'coffee',
        price: 5000,
      },
    });

    // Create orders across 3 days
    const days = 3;
    for (let i = 0; i < days; i++) {
      const orderDate = new Date(startDate);
      orderDate.setDate(orderDate.getDate() + i);
      orderDate.setHours(12, 0, 0, 0);

      const order = await prisma.order.create({
        data: {
          orgId: testOrgId,
          branchId: testBranchId,
          userId: waiter.id,
          orderNumber: `ORD-DAY${i + 1}`,
          status: 'COMPLETED',
          subtotal: 10000,
          tax: 1800,
          total: 11800,
          createdAt: orderDate,
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          quantity: 2,
          unitPrice: 5000,
          subtotal: 10000,
        },
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 11800,
          method: 'CASH',
          status: 'COMPLETED',
        },
      });
    }
  }
});
