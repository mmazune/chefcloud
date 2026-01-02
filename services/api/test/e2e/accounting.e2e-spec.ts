import { createE2EApp } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createChartOfAccounts } from './factory';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('Accounting E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let _orgId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    const prisma = app.get(PrismaService);
    const prismaClient = prisma.client; // Get underlying PrismaClient for factory functions
    
    const factory = await withTimeout(createOrgWithUsers(prismaClient, 'e2e-accounting'), {
      label: 'createOrgWithUsers factory',
      ms: 30000,
    });
    await withTimeout(createChartOfAccounts(prismaClient, factory.orgId), {
      label: 'createChartOfAccounts',
      ms: 15000,
    });

    _orgId = factory.orgId;

    // Login as owner
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.owner.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Chart of Accounts', () => {
    it('GET /accounting/accounts should return >= 18 accounts', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accounts');
      expect(Array.isArray(response.body.accounts)).toBe(true);
      // Factory creates 18 standard accounts matching demo seed
      expect(response.body.accounts.length).toBeGreaterThanOrEqual(18);
      
      // Verify account structure
      const account = response.body.accounts[0];
      expect(account).toHaveProperty('id');
      expect(account).toHaveProperty('code');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('type');
    });
  });

  describe('Journal Entries', () => {
    it('GET /accounting/journal should return entries', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('POST /accounting/journal should create balanced entry', async () => {
      // Get accounts first
      const accountsRes = await request(app.getHttpServer())
        .get('/accounting/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const cashAccount = accountsRes.body.accounts.find((a: { code: string }) => a.code === '1000');
      const salesAccount = accountsRes.body.accounts.find((a: { code: string }) => a.code === '4000');

      if (!cashAccount || !salesAccount) {
        console.log('Skipping journal creation test - accounts not found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: new Date().toISOString(),
          memo: 'E2E Test Entry',
          lines: [
            { accountId: cashAccount.id, debit: 10000, credit: 0 },
            { accountId: salesAccount.id, debit: 0, credit: 10000 },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.memo).toBe('E2E Test Entry');
    });

    it('POST /accounting/journal should reject unbalanced entry', async () => {
      const accountsRes = await request(app.getHttpServer())
        .get('/accounting/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const cashAccount = accountsRes.body.accounts.find((a: { code: string }) => a.code === '1000');
      const salesAccount = accountsRes.body.accounts.find((a: { code: string }) => a.code === '4000');

      if (!cashAccount || !salesAccount) {
        console.log('Skipping unbalanced test - accounts not found');
        return;
      }

      await request(app.getHttpServer())
        .post('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: new Date().toISOString(),
          memo: 'Unbalanced Entry',
          lines: [
            { accountId: cashAccount.id, debit: 10000, credit: 0 },
            { accountId: salesAccount.id, debit: 0, credit: 5000 }, // Unbalanced!
          ],
        })
        .expect(400);
    });
  });

  describe('Financial Statements', () => {
    it('GET /accounting/trial-balance should return balanced totals', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accounts');
      expect(response.body).toHaveProperty('totalDebits');
      expect(response.body).toHaveProperty('totalCredits');
      
      const { totalDebits, totalCredits } = response.body;
      // Trial balance must be balanced
      expect(Math.abs(Number(totalDebits) - Number(totalCredits))).toBeLessThan(0.01);
    });

    it('GET /accounting/pnl should return income statement', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/pnl')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('totalCOGS');
      expect(response.body).toHaveProperty('grossProfit');
      expect(response.body).toHaveProperty('totalExpenses');
      expect(response.body).toHaveProperty('netProfit');
    });

    it('GET /accounting/balance-sheet should return balance sheet', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/balance-sheet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalAssets');
      expect(response.body).toHaveProperty('totalLiabilities');
      expect(response.body).toHaveProperty('totalEquity');
    });
  });

  describe('Fiscal Periods', () => {
    it('GET /accounting/periods should return periods', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/periods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('periods');
      expect(Array.isArray(response.body.periods)).toBe(true);
    });

    it('should create period → close → lock', async () => {
      // Create period with unique date range to avoid overlap
      const uniqueId = Date.now().toString(36);
      const randomMonth = Math.floor(Math.random() * 12) + 1;
      const periodResponse = await request(app.getHttpServer())
        .post('/accounting/periods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Period ' + uniqueId,
          startsAt: `2005-${String(randomMonth).padStart(2, '0')}-01`,
          endsAt: `2005-${String(randomMonth).padStart(2, '0')}-28`,
        })
        .expect(201);

      expect(periodResponse.body).toHaveProperty('period');
      const periodId = periodResponse.body.period.id;
      expect(periodResponse.body.period.status).toBe('OPEN');

      // Close period
      const closeResponse = await request(app.getHttpServer())
        .patch(`/accounting/periods/${periodId}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(closeResponse.body.period.status).toBe('CLOSED');

      // Lock period
      const lockResponse = await request(app.getHttpServer())
        .patch(`/accounting/periods/${periodId}/lock`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(lockResponse.body.period.status).toBe('LOCKED');
      expect(lockResponse.body.period.lockedAt).toBeDefined();
    });
  });

  describe('AP/AR Aging', () => {
    it('GET /accounting/ap/aging should return AP aging', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/ap/aging')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bills');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('thirtyDays');
    });

    it('GET /accounting/ar/aging should return AR aging', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/ar/aging')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('invoices');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('thirtyDays');
    });
  });
});
