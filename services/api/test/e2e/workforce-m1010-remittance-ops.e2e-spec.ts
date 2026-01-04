/**
 * M10.10: Remittance Automation E2E Tests
 *
 * STANDARD: instructions/E2E_TESTING_STANDARD.md
 *
 * Tests:
 * - H1: Provider CRUD
 * - H2: Component → Provider Mapping
 * - H3: Mark settled with reconciliation metadata
 * - H4: Bank upload CSV export
 * - H5: RBAC enforcement (L5 only for mark-settled)
 * - H6: Provider delete protection
 */

import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';
import { trace, traceSpan } from '../helpers/e2e-trace';
import { loginAs } from '../helpers/e2e-login';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { Prisma } from '@chefcloud/db';

// Layer B: Jest file timeout (120s for full AppModule tests)
jest.setTimeout(120_000);

describe('M10.10 Remittance Automation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let orgId: string;
  let branchId: string;

  // Test data IDs
  let liabilityAccountId: string;
  let cashAccountId: string;
  let providerId: string;
  let componentId: string;

  beforeAll(async () => {
    await traceSpan('beforeAll', async () => {
      trace('creating E2E app');

      app = await withTimeout(
        createE2EApp({ imports: [AppModule] }),
        { ms: 60_000, label: 'createE2EApp' }
      );

      prisma = app.get(PrismaService);
      trace('app created, logging in users');

      // Login as owner (L5)
      const ownerLogin = await withTimeout(
        loginAs(app, 'owner'),
        { ms: 10_000, label: 'ownerLogin' }
      );
      ownerToken = ownerLogin.accessToken;
      orgId = ownerLogin.user.orgId;

      // Login as manager (L4)
      const managerLogin = await withTimeout(
        loginAs(app, 'manager'),
        { ms: 10_000, label: 'managerLogin' }
      );
      managerToken = managerLogin.accessToken;

      // Get or create test accounts
      let liabilityAccount = await prisma.client.account.findFirst({
        where: { orgId, type: 'LIABILITY' },
      });
      if (!liabilityAccount) {
        liabilityAccount = await prisma.client.account.create({
          data: { orgId, code: '2100', name: 'Taxes Payable', type: 'LIABILITY' },
        });
      }
      liabilityAccountId = liabilityAccount.id;

      let cashAccount = await prisma.client.account.findFirst({
        where: { orgId, type: 'ASSET' },
      });
      if (!cashAccount) {
        cashAccount = await prisma.client.account.create({
          data: { orgId, code: '1000', name: 'Cash', type: 'ASSET' },
        });
      }
      cashAccountId = cashAccount.id;

      // Get a branch for testing
      const branch = await prisma.client.branch.findFirst({
        where: { orgId },
      });
      if (branch) {
        branchId = branch.id;
      }

      trace('beforeAll complete', { orgId, branchId: branchId || 'none' });
    });
  });

  afterAll(async () => {
    await traceSpan('afterAll', async () => {
      trace('cleaning up test data');

      if (prisma) {
        // Clean up M10.10-specific test data
        try {
          await prisma.client.compensationRemittanceMapping.deleteMany({
            where: { component: { orgId } },
          });
        } catch (e) {
          trace('Could not clean mappings', { error: (e as Error).message });
        }

        try {
          await prisma.client.remittanceProvider.deleteMany({
            where: { orgId, name: { startsWith: 'E2E_' } },
          });
        } catch (e) {
          trace('Could not clean providers', { error: (e as Error).message });
        }

        try {
          await prisma.client.compensationComponent.deleteMany({
            where: { orgId, code: { startsWith: 'E2E_' } },
          });
        } catch (e) {
          trace('Could not clean components', { error: (e as Error).message });
        }
      }

      trace('closing app');
      await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
      trace('afterAll complete');
    });
  });

  // ===== H1: Provider CRUD =====
  describe('H1: Provider CRUD', () => {
    it('should create a remittance provider (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittance-providers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'E2E_URA Tax Authority',
          type: 'TAX_AUTHORITY',
          referenceFormatHint: 'TIN-XXXXXX',
          defaultLiabilityAccountId: liabilityAccountId,
          defaultCashAccountId: cashAccountId,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toMatchObject({
        name: 'E2E_URA Tax Authority',
        type: 'TAX_AUTHORITY',
      });
      providerId = res.body.id;
    });

    it('should list providers (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittance-providers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should get provider by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittance-providers/${providerId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(providerId);
    });

    it('should update provider', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${orgId}/remittance-providers/${providerId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'E2E_Uganda Revenue Authority' })
        .expect(HttpStatus.OK);

      expect(res.body.name).toBe('E2E_Uganda Revenue Authority');
    });
  });

  // ===== H2: Component Mapping =====
  describe('H2: Component Mapping', () => {
    beforeAll(async () => {
      // Find an existing compensation component or create one via SQL
      const existingComponent = await prisma.client.compensationComponent.findFirst({
        where: { orgId },
      });

      if (existingComponent) {
        componentId = existingComponent.id;
      } else {
        // Use raw SQL to create if Prisma types are missing
        const [result] = await prisma.client.$queryRaw<Array<{ id: string }>>`
          INSERT INTO "compensation_components" ("id", "orgId", "code", "name", "type", "calcMethod", "amount", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${orgId}, 'E2E_PAYE', 'E2E PAYE Tax', 'TAX', 'FIXED', 100, NOW(), NOW())
          RETURNING "id"
        `;
        componentId = result.id;
      }
    });

    it('should create a mapping (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittance-mappings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          componentId,
          providerId,
          remittanceType: 'TAX',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toMatchObject({
        componentId,
        providerId,
        remittanceType: 'TAX',
      });
    });

    it('should list mappings (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittance-mappings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should upsert existing mapping', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittance-mappings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          componentId,
          providerId,
          remittanceType: 'DEDUCTION', // Change type
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.remittanceType).toBe('DEDUCTION');
    });
  });

  // ===== H3: Mark Settled =====
  describe('H3: Mark Settled', () => {
    let paidBatchId: string;

    beforeAll(async () => {
      // Get owner user ID
      const owner = await prisma.client.user.findFirst({
        where: { orgId, roleLevel: 'L5' },
      });

      // Create and pay a batch for this test
      const batch = await prisma.client.remittanceBatch.create({
        data: {
          orgId,
          type: 'TAX',
          status: 'PAID',
          createdById: owner!.id,
          paidById: owner!.id,
          paidAt: new Date(),
          totalAmount: new Prisma.Decimal(100),
        },
      });
      paidBatchId = batch.id;
    });

    it('should mark batch as settled with reconciliation metadata (L5 only)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${paidBatchId}/mark-settled`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          externalReference: 'BANK-TXN-12345',
          settlementMethod: 'BANK_TRANSFER',
          receiptNote: 'URA payment receipt #001',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.settledAt).toBeDefined();
      expect(res.body.externalReference).toBe('BANK-TXN-12345');
      expect(res.body.settlementMethod).toBe('BANK_TRANSFER');
    });

    it('should reject double settlement', async () => {
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${paidBatchId}/mark-settled`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ settlementMethod: 'CASH' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ===== H4: Bank Upload Export =====
  describe('H4: Bank Upload Export', () => {
    let exportBatchId: string;

    beforeAll(async () => {
      const owner = await prisma.client.user.findFirst({
        where: { orgId, roleLevel: 'L5' },
      });

      const batch = await prisma.client.remittanceBatch.create({
        data: {
          orgId,
          type: 'TAX',
          status: 'POSTED',
          createdById: owner!.id,
          currencyCode: 'UGX',
          totalAmount: new Prisma.Decimal(500),
          lines: {
            create: {
              liabilityAccountId,
              counterAccountId: cashAccountId,
              amount: new Prisma.Decimal(500),
              payeeName: 'E2E_URA Tax',
              referenceCode: 'TIN-123456',
            },
          },
        },
      });
      exportBatchId = batch.id;
    });

    it('should export bank upload CSV', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances/${exportBatchId}/bank-upload`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK)
        .expect('Content-Type', /text\/csv/);

      expect(res.text).toContain('payeeName');
      expect(res.text).toContain('E2E_URA Tax');
    });
  });

  // ===== H5: RBAC Enforcement =====
  describe('H5: RBAC Enforcement', () => {
    let rbacBatchId: string;

    beforeAll(async () => {
      const owner = await prisma.client.user.findFirst({
        where: { orgId, roleLevel: 'L5' },
      });

      const batch = await prisma.client.remittanceBatch.create({
        data: {
          orgId,
          type: 'TAX',
          status: 'PAID',
          createdById: owner!.id,
          paidById: owner!.id,
          paidAt: new Date(),
          totalAmount: new Prisma.Decimal(100),
        },
      });
      rbacBatchId = batch.id;
    });

    it('L4 should NOT be able to mark-settled (L5 only)', async () => {
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${rbacBatchId}/mark-settled`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ settlementMethod: 'CASH' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('L4 should be able to list providers (L4+ allowed)', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittance-providers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);
    });
  });

  // ===== H6: Provider Delete Protection =====
  describe('H6: Provider Delete Protection', () => {
    it('should not delete provider with existing mappings', async () => {
      await request(app.getHttpServer())
        .delete(`/orgs/${orgId}/remittance-providers/${providerId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
