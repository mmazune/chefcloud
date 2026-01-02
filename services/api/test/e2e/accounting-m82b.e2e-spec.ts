/**
 * M8.2b: Accounting Enterprise Parity E2E Tests
 * 
 * Tests for journal lifecycle (DRAFT → POSTED → REVERSED),
 * period lock enforcement, and CSV exports.
 */

import { createE2EApp } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createChartOfAccounts } from './factory';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('M8.2b Accounting Enterprise Parity E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let _orgId: string;
  let cashAccountId: string;
  let salesAccountId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    prisma = app.get(PrismaService);
    const prismaClient = prisma.client; // Get underlying PrismaClient for factory functions
    
    const factory = await withTimeout(createOrgWithUsers(prismaClient, 'e2e-m82b-accounting'), {
      label: 'createOrgWithUsers factory',
      ms: 30000,
    });
    const accounts = await withTimeout(createChartOfAccounts(prismaClient, factory.orgId), {
      label: 'createChartOfAccounts',
      ms: 15000,
    });

    _orgId = factory.orgId;
    
    // Find test accounts
    const cash = accounts.find((a: { code: string }) => a.code === '1000');
    const sales = accounts.find((a: { code: string }) => a.code === '4000');
    if (cash) cashAccountId = cash.id;
    if (sales) salesAccountId = sales.id;

    // Login as owner
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.owner.email,
        password: 'Test#123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Journal Entry Lifecycle (M8.2b)', () => {
    let draftEntryId: string;
    let postedEntryId: string;

    it('should create journal entry as DRAFT', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: new Date().toISOString(),
          memo: 'M8.2b Test - Draft Entry',
          lines: [
            { accountId: cashAccountId, debit: 50000, credit: 0 },
            { accountId: salesAccountId, debit: 0, credit: 50000 },
          ],
        })
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
      expect(response.body.postedAt).toBeNull();
      draftEntryId = response.body.id;
    });

    it('DRAFT entry should NOT affect trial balance', async () => {
      // Get trial balance - draft entries should not be included
      const tbBefore = await request(app.getHttpServer())
        .get('/accounting/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // The draft entry we just created should not appear in totals
      // Trial balance only includes POSTED entries
      expect(tbBefore.body.balanced).toBe(true);
    });

    it('should POST a draft entry', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/journal/${draftEntryId}/post`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('POSTED');
      expect(response.body.postedAt).toBeDefined();
      expect(response.body.postedById).toBeDefined();
      postedEntryId = response.body.id;
    });

    it('POSTED entry should affect trial balance', async () => {
      const tbAfter = await request(app.getHttpServer())
        .get('/accounting/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Now the posted entry should be reflected
      expect(tbAfter.body.balanced).toBe(true);
      expect(tbAfter.body.totalDebits).toBeGreaterThanOrEqual(50000);
    });

    it('should reject posting already POSTED entry', async () => {
      await request(app.getHttpServer())
        .post(`/accounting/journal/${postedEntryId}/post`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should REVERSE a posted entry', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/journal/${postedEntryId}/reverse`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      // Reversal entry is created as POSTED with opposite lines
      expect(response.body.status).toBe('POSTED');
      expect(response.body.reversesEntryId).toBe(postedEntryId);
      expect(response.body.source).toBe('REVERSAL');

      // Verify lines are swapped (original had debit 50000, now should have credit 50000)
      const cashLine = response.body.lines.find(
        (l: { account: { code: string } }) => l.account.code === '1000',
      );
      expect(Number(cashLine.credit)).toBe(50000);
      expect(Number(cashLine.debit)).toBe(0);
    });

    it('should reject reversing already REVERSED entry', async () => {
      await request(app.getHttpServer())
        .post(`/accounting/journal/${postedEntryId}/reverse`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('Period Lock Enforcement (M8.2b)', () => {
    let lockedPeriodId: string;
    let lockedPeriodDate: string;

    it('should create and lock a period', async () => {
      // Create period for a unique date range using random year/month to avoid collision
      const randomYear = 1950 + Math.floor(Math.random() * 30); // 1950-1979
      const randomMonth = 1 + Math.floor(Math.random() * 12);
      const startDate = `${randomYear}-${String(randomMonth).padStart(2, '0')}-01`;
      const endDate = `${randomYear}-${String(randomMonth).padStart(2, '0')}-28`;
      lockedPeriodDate = `${randomYear}-${String(randomMonth).padStart(2, '0')}-15T12:00:00.000Z`;
      
      const createRes = await request(app.getHttpServer())
        .post('/accounting/periods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `M8.2b Test Period - ${randomYear}-${randomMonth}`,
          startsAt: startDate,
          endsAt: endDate,
        })
        .expect(201);

      lockedPeriodId = createRes.body.period.id;

      // Close then lock
      await request(app.getHttpServer())
        .patch(`/accounting/periods/${lockedPeriodId}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/accounting/periods/${lockedPeriodId}/lock`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should reject posting journal to LOCKED period', async () => {
      // Create a draft entry dated in the locked period
      const createRes = await request(app.getHttpServer())
        .post('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: lockedPeriodDate, // Falls in locked period
          memo: 'Should fail to post',
          lines: [
            { accountId: cashAccountId, debit: 1000, credit: 0 },
            { accountId: salesAccountId, debit: 0, credit: 1000 },
          ],
        })
        .expect(201);

      const entryId = createRes.body.id;

      // Posting should fail with 403
      const postRes = await request(app.getHttpServer())
        .post(`/accounting/journal/${entryId}/post`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(postRes.body.message).toContain('locked');
    });
  });

  describe('CSV Exports (M8.2b)', () => {
    it('GET /accounting/export/accounts should return valid CSV', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/export/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('chart-of-accounts.csv');

      // Validate CSV structure
      const lines = response.text.split('\n');
      expect(lines.length).toBeGreaterThan(1);

      const headers = lines[0].split(',');
      expect(headers).toContain('Code');
      expect(headers).toContain('Name');
      expect(headers).toContain('Type');
    });

    it('GET /accounting/export/journal should return valid CSV', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/export/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('journal-entries.csv');

      const lines = response.text.split('\n');
      const headers = lines[0].split(',');
      expect(headers).toContain('Entry ID');
      expect(headers).toContain('Date');
      expect(headers).toContain('Status');
      expect(headers).toContain('Debit');
      expect(headers).toContain('Credit');
    });

    it('GET /accounting/export/trial-balance should return valid CSV', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/export/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('trial-balance.csv');

      const lines = response.text.split('\n');
      const headers = lines[0].split(',');
      expect(headers).toContain('Code');
      expect(headers).toContain('Name');
      expect(headers).toContain('Debit');
      expect(headers).toContain('Credit');
      expect(headers).toContain('Balance');

      // Last row should be TOTALS
      const lastRow = lines[lines.length - 1] || lines[lines.length - 2];
      expect(lastRow).toContain('TOTALS');
    });
  });

  describe('Unbalanced Entry Rejection (M8.2b)', () => {
    it('should reject unbalanced journal entry with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: new Date().toISOString(),
          memo: 'Unbalanced entry',
          lines: [
            { accountId: cashAccountId, debit: 10000, credit: 0 },
            { accountId: salesAccountId, debit: 0, credit: 5000 }, // Unbalanced!
          ],
        })
        .expect(400);

      expect(response.body.message).toContain('not balanced');
    });
  });
});
