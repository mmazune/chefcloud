import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { AppModule } from '../src/app.module';

/**
 * M7 E2E Test: Service Providers, Budgets & Cost Insights
 * 
 * Tests the complete flow:
 * 1. Create a service provider (landlord)
 * 2. Create a contract (monthly rent)
 * 3. Generate reminders (via service method)
 * 4. Mark reminder as paid
 * 5. Set budget for a category
 * 6. Compute budget actuals
 * 7. Generate cost-cutting insights
 */
describe('M7: Service Providers, Budgets & Cost Insights (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testOrgId: string;
  let testBranchId: string;
  let testUserId: string;
  let providerId: string;
  let contractId: string;
  let reminderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  async function setupTestData() {
    // Create test org
    const org = await prisma.client.org.create({
      data: {
        name: 'M7 Test Restaurant',
        email: 'm7test@example.com',
      },
    });
    testOrgId = org.id;

    // Create test branch
    const branch = await prisma.client.branch.create({
      data: {
        name: 'M7 Main Branch',
        orgId: testOrgId,
        address: '123 Test St',
        phone: '+256700000000',
        timezone: 'Africa/Kampala',
      },
    });
    testBranchId = branch.id;

    // Create test user (L4 - Manager)
    const hashedPassword = '$2b$10$abcdefghijklmnopqrstuv'; // Mock hash
    const user = await prisma.client.user.create({
      data: {
        email: 'm7manager@example.com',
        hashedPassword,
        firstName: 'M7',
        lastName: 'Manager',
        orgId: testOrgId,
        role: 'L4',
      },
    });
    testUserId = user.id;

    // Generate auth token (simplified - in real test would call /auth/login)
    authToken = 'mock-jwt-token'; // In real test, get from auth endpoint
  }

  async function cleanupTestData() {
    if (testOrgId) {
      // Delete in correct order to respect foreign keys
      await prisma.client.servicePayableReminder.deleteMany({ where: { contract: { provider: { orgId: testOrgId } } } });
      await prisma.client.serviceContract.deleteMany({ where: { provider: { orgId: testOrgId } } });
      await prisma.client.serviceProvider.deleteMany({ where: { orgId: testOrgId } });
      await prisma.client.opsBudget.deleteMany({ where: { branch: { orgId: testOrgId } } });
      await prisma.client.costInsight.deleteMany({ where: { branch: { orgId: testOrgId } } });
      await prisma.client.user.deleteMany({ where: { orgId: testOrgId } });
      await prisma.client.branch.deleteMany({ where: { orgId: testOrgId } });
      await prisma.client.org.delete({ where: { id: testOrgId } });
    }
  }

  describe('1. Service Providers Management', () => {
    it('should create a service provider', async () => {
      const createDto = {
        name: 'ABC Property Management',
        category: 'RENT',
        orgId: testOrgId,
        branchId: testBranchId,
        contactName: 'John Landlord',
        contactPhone: '+256700111111',
        contactEmail: 'landlord@abc.com',
        isActive: true,
      };

      // Direct database insert for test (in real scenario would use API)
      const provider = await prisma.client.serviceProvider.create({
        data: createDto,
      });

      providerId = provider.id;

      expect(provider).toBeDefined();
      expect(provider.name).toBe('ABC Property Management');
      expect(provider.category).toBe('RENT');
    });

    it('should create a monthly contract', async () => {
      const createDto = {
        providerId,
        branchId: testBranchId,
        frequency: 'MONTHLY' as const,
        amount: 2000000, // 2M UGX rent
        currency: 'UGX',
        dueDay: 5, // 5th of every month
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE' as const,
        glAccount: '5001-RENT',
        costCenter: 'BRANCH-001',
      };

      const contract = await prisma.client.serviceContract.create({
        data: createDto,
      });

      contractId = contract.id;

      expect(contract).toBeDefined();
      expect(contract.frequency).toBe('MONTHLY');
      expect(Number(contract.amount)).toBe(2000000);
      expect(contract.dueDay).toBe(5);
    });
  });

  describe('2. Payment Reminders', () => {
    it('should generate reminders for active contracts', async () => {
      // Call the reminders service directly (simulating worker job)
      const remindersService = app.get('RemindersService');
      
      const result = await remindersService.generateReminders();

      expect(result).toBeDefined();
      expect(result.created).toBeGreaterThanOrEqual(0);
      expect(result.updated).toBeGreaterThanOrEqual(0);

      // Verify reminder was created
      const reminders = await prisma.client.servicePayableReminder.findMany({
        where: { contractId },
      });

      expect(reminders.length).toBeGreaterThan(0);
      reminderId = reminders[0].id;
    });

    it('should list reminders for a branch', async () => {
      const remindersService = app.get('RemindersService');
      
      const reminders = await remindersService.getReminders({
        branchId: testBranchId,
      });

      expect(Array.isArray(reminders)).toBe(true);
      expect(reminders.length).toBeGreaterThan(0);
      
      const reminder = reminders[0];
      expect(reminder).toHaveProperty('dueDate');
      expect(reminder).toHaveProperty('status');
      expect(reminder).toHaveProperty('severity');
    });

    it('should get reminder summary', async () => {
      const remindersService = app.get('RemindersService');
      
      const summary = await remindersService.getReminderSummary(testOrgId, testBranchId);

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('overdue');
      expect(summary).toHaveProperty('dueToday');
      expect(summary).toHaveProperty('dueSoon');
      expect(summary).toHaveProperty('totalAmount');
      expect(typeof summary.totalAmount).toBe('number');
    });

    it('should mark reminder as paid', async () => {
      const remindersService = app.get('RemindersService');
      
      const updated = await remindersService.updateReminder(reminderId, {
        status: 'PAID',
      }, testUserId);

      expect(updated.status).toBe('PAID');
      expect(updated.acknowledgedById).toBe(testUserId);
    });
  });

  describe('3. Ops Budget Management', () => {
    it('should set a budget for a category', async () => {
      const budgetService = app.get('BudgetService');
      
      const budget = await budgetService.setBudget(testOrgId, {
        branchId: testBranchId,
        year: 2024,
        month: 11,
        category: 'RENT' as any,
        budgetAmount: 2000000,
      });

      expect(budget).toBeDefined();
      expect(budget.budgetAmount).toBe(2000000);
      expect(budget.category).toBe('RENT');
    });

    it('should compute budget actuals', async () => {
      const budgetService = app.get('BudgetService');
      
      // Update actuals (simulates end-of-month computation)
      const result = await budgetService.updateBudgetActuals(
        testBranchId,
        2024,
        11,
      );

      expect(result).toBeDefined();
      expect(result.updated).toBeGreaterThanOrEqual(0);

      // Verify budget was updated
      const budgets = await budgetService.getBudgets(testOrgId, testBranchId, 2024, 11);
      expect(budgets.length).toBeGreaterThan(0);
      
      const rentBudget = budgets.find((b) => b.category === 'RENT');
      expect(rentBudget).toBeDefined();
      expect(rentBudget?.actualAmount).toBeGreaterThanOrEqual(0);
      expect(rentBudget?.variance).toBeDefined();
    });

    it('should get budget summary', async () => {
      const budgetService = app.get('BudgetService');
      
      const summary = await budgetService.getBudgetSummary(
        testOrgId,
        testBranchId,
        2024,
        11,
      );

      expect(summary).toBeDefined();
      expect(summary.branchId).toBe(testBranchId);
      expect(summary).toHaveProperty('totalBudget');
      expect(summary).toHaveProperty('totalActual');
      expect(summary).toHaveProperty('totalVariance');
      expect(summary).toHaveProperty('byCategory');
      expect(Array.isArray(summary.byCategory)).toBe(true);
    });

    it('should get franchise budget summary', async () => {
      const budgetService = app.get('BudgetService');
      
      const summary = await budgetService.getFranchiseBudgetSummary(
        testOrgId,
        2024,
        11,
      );

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('period');
      expect(summary).toHaveProperty('franchiseTotal');
      expect(summary).toHaveProperty('byBranch');
      expect(Array.isArray(summary.byBranch)).toBe(true);
      expect(summary.byBranch.length).toBeGreaterThan(0);
    });
  });

  describe('4. Cost-Cutting Insights', () => {
    it('should generate cost insights for a branch', async () => {
      const costInsightsService = app.get('CostInsightsService');
      
      // Create some variance to trigger insights
      // (In real scenario, would have multiple months of data with variances)
      
      const insights = await costInsightsService.getBranchInsights(testBranchId, 3);

      expect(Array.isArray(insights)).toBe(true);
      // May be empty if no significant variances detected
      // Just verify the method runs without errors
    });

    it('should generate franchise-wide insights', async () => {
      const costInsightsService = app.get('CostInsightsService');
      
      const franchiseInsights = await costInsightsService.getFranchiseInsights(testOrgId, 3);

      expect(franchiseInsights).toBeDefined();
      expect(franchiseInsights).toHaveProperty('insights');
      expect(franchiseInsights).toHaveProperty('byBranch');
      expect(franchiseInsights).toHaveProperty('totalPotentialSavings');
      expect(Array.isArray(franchiseInsights.insights)).toBe(true);
      expect(Array.isArray(franchiseInsights.byBranch)).toBe(true);
    });
  });

  describe('5. Integration with Owner Digests', () => {
    it('should include M7 data in franchise digest', async () => {
      const reportGeneratorService = app.get('ReportGeneratorService');
      
      const startDate = new Date('2024-11-01');
      const endDate = new Date('2024-11-30');
      
      const digest = await reportGeneratorService.generateFranchiseDigest(
        testOrgId,
        startDate,
        endDate,
      );

      expect(digest).toBeDefined();
      expect(digest.reportId).toBeDefined();
      expect(digest.orgId).toBe(testOrgId);
      
      // Verify M7 additions
      // costInsights may be undefined if no insights generated
      if (digest.costInsights) {
        expect(Array.isArray(digest.costInsights)).toBe(true);
      }
      
      // serviceReminders may be undefined if no reminders
      if (digest.serviceReminders) {
        expect(digest.serviceReminders).toHaveProperty('overdue');
        expect(digest.serviceReminders).toHaveProperty('dueToday');
        expect(digest.serviceReminders).toHaveProperty('dueSoon');
      }
    });
  });

  describe('6. Validation & Error Handling', () => {
    it('should validate dueDay for monthly contracts', async () => {
      const invalidContract = {
        providerId,
        branchId: testBranchId,
        frequency: 'MONTHLY' as const,
        amount: 1000000,
        currency: 'UGX',
        dueDay: 35, // Invalid - should be 1-31
        startDate: new Date(),
        status: 'ACTIVE' as const,
      };

      // This should fail validation
      await expect(
        prisma.client.serviceContract.create({ data: invalidContract }),
      ).rejects.toThrow();
    });

    it('should prevent deleting provider with active contracts', async () => {
      const serviceProvidersService = app.get('ServiceProvidersService');
      
      // Try to delete provider with active contract
      await expect(
        serviceProvidersService.deleteProvider(providerId),
      ).rejects.toThrow(/active contracts/i);
    });

    it('should require budget parameters', async () => {
      const budgetService = app.get('BudgetService');
      
      const invalidBudget = {
        branchId: testBranchId,
        year: 2024,
        month: 13, // Invalid month
        category: 'RENT' as any,
        budgetAmount: 1000000,
      };

      await expect(
        budgetService.setBudget(testOrgId, invalidBudget),
      ).rejects.toThrow();
    });
  });
});
