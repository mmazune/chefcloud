/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('E22-s2: Franchise APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let branch1Id: string;
  let branch2Id: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Create test org
    const org = await prisma.client.org.create({
      data: {
        name: 'E22 Franchise Org',
        currency: 'UGX',
      },
    });
    orgId = org.id;

    // Create org settings with custom weights
    await prisma.client.orgSettings.create({
      data: {
        orgId,
        franchiseWeights: {
          revenue: 0.5,
          margin: 0.3,
          waste: -0.15,
          sla: 0.05,
        },
      },
    });

    // Create two test branches
    const branch1 = await prisma.client.branch.create({
      data: {
        orgId,
        name: 'Branch Alpha',
        timezone: 'Africa/Kampala',
      },
    });
    branch1Id = branch1.id;

    const branch2 = await prisma.client.branch.create({
      data: {
        orgId,
        name: 'Branch Beta',
        timezone: 'Africa/Kampala',
      },
    });
    branch2Id = branch2.id;

    // Create Owner (L5) user
    const user = await prisma.client.user.create({
      data: {
        orgId,
        email: 'e22-owner@test.local',
        firstName: 'Owner',
        lastName: 'User',
        role: 'L5', // Owner
        passwordHash: 'dummy-hash',
      },
    });

    // Mock token (in production, would login properly)
    ownerToken = 'mock-owner-token';

    // Seed some orders for rankings
    await prisma.client.order.create({
      data: {
        branchId: branch1Id,
        userId: user.id,
        orderNumber: 'ORD-001',
        status: 'CLOSED',
        total: 150000,
      },
    });

    await prisma.client.order.create({
      data: {
        branchId: branch2Id,
        userId: user.id,
        orderNumber: 'ORD-002',
        status: 'CLOSED',
        total: 100000,
      },
    });

    // Seed wastage (Branch Beta has more waste)
    await prisma.client.wastage.create({
      data: {
        orgId,
        branchId: branch1Id,
        itemId: 'dummy-item',
        qty: 2,
        reason: 'Spoilage',
        loggedBy: user.id,
      },
    });

    await prisma.client.wastage.create({
      data: {
        orgId,
        branchId: branch2Id,
        itemId: 'dummy-item',
        qty: 10,
        reason: 'Spoilage',
        loggedBy: user.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.client.order.deleteMany({ where: { branchId: { in: [branch1Id, branch2Id] } } });
    await prisma.client.wastage.deleteMany({ where: { orgId } });
    await prisma.client.branchBudget.deleteMany({ where: { orgId } });
    await prisma.client.user.deleteMany({ where: { orgId } });
    await prisma.client.branch.deleteMany({ where: { orgId } });
    await prisma.client.orgSettings.deleteMany({ where: { orgId } });
    await prisma.client.org.delete({ where: { id: orgId } });
    await app.close();
  });

  describe('POST /franchise/budgets', () => {
    it('should upsert a budget for a branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: branch1Id,
          period: '2025-11',
          revenueTarget: 500000,
          cogsTarget: 200000,
          expenseTarget: 100000,
          notes: 'Q4 budget',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.branchId).toBe(branch1Id);
      expect(res.body.period).toBe('2025-11');
      expect(res.body.revenueTarget).toBe(500000);
    });

    it('should update existing budget on re-upsert', async () => {
      // First upsert
      await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: branch2Id,
          period: '2025-11',
          revenueTarget: 300000,
          cogsTarget: 150000,
          expenseTarget: 80000,
        })
        .expect(201);

      // Second upsert with updated values
      const res = await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: branch2Id,
          period: '2025-11',
          revenueTarget: 400000, // Updated
          cogsTarget: 150000,
          expenseTarget: 80000,
        })
        .expect(201);

      expect(res.body.revenueTarget).toBe(400000);
    });
  });

  describe('GET /franchise/budgets', () => {
    it('should fetch budgets for a period', async () => {
      const res = await request(app.getHttpServer())
        .get('/franchise/budgets?period=2025-11')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('branchName');
      expect(res.body[0]).toHaveProperty('revenueTarget');
    });

    it('should reject invalid period format', async () => {
      const res = await request(app.getHttpServer())
        .get('/franchise/budgets?period=2025')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.error).toContain('Invalid period');
    });
  });

  describe('GET /franchise/rankings', () => {
    it('should return ranked branches with deterministic ordering', async () => {
      const period = new Date().toISOString().slice(0, 7); // Current month

      const res = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);

      // Branch Alpha should rank #1 (higher revenue, less waste)
      expect(res.body[0].branchName).toBe('Branch Alpha');
      expect(res.body[0].rank).toBe(1);

      // Branch Beta should rank #2
      expect(res.body[1].branchName).toBe('Branch Beta');
      expect(res.body[1].rank).toBe(2);

      // Verify metrics are included
      expect(res.body[0].metrics).toHaveProperty('revenue');
      expect(res.body[0].metrics).toHaveProperty('margin');
      expect(res.body[0].metrics).toHaveProperty('waste');
      expect(res.body[0].metrics).toHaveProperty('sla');
    });
  });

  describe('GET /franchise/procurement/suggest', () => {
    it('should return items below safety stock', async () => {
      // Create inventory item below reorder level
      const item = await prisma.client.inventoryItem.create({
        data: {
          orgId,
          sku: 'TEST-001',
          name: 'Test Item',
          unit: 'kg',
          reorderLevel: 100,
          reorderQty: 200,
        },
      });

      // Create stock batch with low quantity
      await prisma.client.stockBatch.create({
        data: {
          orgId,
          branchId: branch1Id,
          itemId: item.id,
          receivedQty: 50,
          remainingQty: 30,
          unitCost: 1000,
          receivedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/franchise/procurement/suggest')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const suggestion = res.body.find((s: any) => s.itemName === 'Test Item');

      expect(suggestion).toBeDefined();
      expect(suggestion.currentStock).toBe(30);
      expect(suggestion.safetyStock).toBe(100);
      expect(suggestion.suggestedQty).toBe(200);

      // Cleanup
      await prisma.client.stockBatch.deleteMany({ where: { itemId: item.id } });
      await prisma.client.inventoryItem.delete({ where: { id: item.id } });
    });
  });

  describe('E22-s3: Central Procurement', () => {
    let supplierId: string;
    let itemId: string;

    beforeAll(async () => {
      // Create supplier with packSize and minOrderQty
      const supplier = await prisma.client.supplier.create({
        data: {
          orgId,
          name: 'Test Supplier',
          email: 'test-supplier@example.com',
          contactPerson: 'John Doe',
          phone: '+256700000000',
          leadTimeDays: 3,
          packSize: 10, // Must order in packs of 10
          minOrderQty: 50, // Minimum order is 50 units
        },
      });
      supplierId = supplier.id;

      // Create inventory item linked to supplier (via metadata)
      const item = await prisma.client.inventoryItem.create({
        data: {
          orgId,
          sku: 'PROC-001',
          name: 'Procurement Test Item',
          unit: 'kg',
          reorderLevel: 100,
          reorderQty: 60, // Will be rounded to 60 (multiple of packSize)
          metadata: { supplierId },
        },
      });
      itemId = item.id;

      // Create stock batch below reorder level
      await prisma.client.stockBatch.create({
        data: {
          orgId,
          branchId: branch1Id,
          itemId: item.id,
          receivedQty: 50,
          remainingQty: 40, // Below reorder level of 100
          unitCost: 2000,
          receivedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.client.purchaseOrderItem.deleteMany({
        where: { item: { orgId } },
      });
      await prisma.client.purchaseOrder.deleteMany({ where: { orgId } });
      await prisma.client.procurementJob.deleteMany({ where: { orgId } });
      await prisma.client.stockBatch.deleteMany({ where: { itemId } });
      await prisma.client.inventoryItem.delete({ where: { id: itemId } });
      await prisma.client.supplier.delete({ where: { id: supplierId } });
    });

    describe('POST /franchise/procurement/generate-drafts', () => {
      it('should generate draft POs with packSize rounding', async () => {
        const res = await request(app.getHttpServer())
          .post('/franchise/procurement/generate-drafts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            strategy: 'SAFETY_STOCK',
          })
          .expect(201);

        expect(res.body).toHaveProperty('jobId');
        expect(res.body).toHaveProperty('drafts');
        expect(Array.isArray(res.body.drafts)).toBe(true);

        const draft = res.body.drafts.find((d: any) => d.supplierId === supplierId);
        expect(draft).toBeDefined();
        expect(draft.branchId).toBe(branch1Id);
        expect(draft.itemsCount).toBe(1);
      });

      it('should generate drafts for specific branches only', async () => {
        const res = await request(app.getHttpServer())
          .post('/franchise/procurement/generate-drafts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            strategy: 'SAFETY_STOCK',
            branchIds: [branch1Id], // Only branch1
          })
          .expect(201);

        expect(res.body.drafts.every((d: any) => d.branchId === branch1Id)).toBe(true);
      });
    });

    describe('GET /franchise/procurement/drafts', () => {
      it('should list all draft POs with supplier and branch names', async () => {
        const res = await request(app.getHttpServer())
          .get('/franchise/procurement/drafts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        const draft = res.body[0];
        expect(draft).toHaveProperty('poId');
        expect(draft).toHaveProperty('poNumber');
        expect(draft).toHaveProperty('supplierName');
        expect(draft).toHaveProperty('branchName');
        expect(draft).toHaveProperty('itemsCount');
        expect(draft).toHaveProperty('total');
      });
    });

    describe('POST /franchise/procurement/approve', () => {
      it('should approve draft POs and update status to PLACED', async () => {
        // Get current drafts
        const draftsRes = await request(app.getHttpServer())
          .get('/franchise/procurement/drafts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        const poIds = draftsRes.body.map((d: any) => d.poId);

        const res = await request(app.getHttpServer())
          .post('/franchise/procurement/approve')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ poIds })
          .expect(201);

        expect(res.body).toHaveProperty('approved');
        expect(res.body.approved).toBe(poIds.length);

        // Verify no more drafts exist
        const afterApprovalRes = await request(app.getHttpServer())
          .get('/franchise/procurement/drafts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(afterApprovalRes.body.length).toBe(0);
      });

      it('should reject non-owner approval attempts', async () => {
        // Create L4 user (Manager, not Owner)
        const manager = await prisma.client.user.create({
          data: {
            orgId,
            email: 'manager@test.local',
            firstName: 'Manager',
            lastName: 'User',
            role: 'L4',
            passwordHash: 'dummy-hash',
          },
        });

        const managerToken = 'mock-manager-token';

        const res = await request(app.getHttpServer())
          .post('/franchise/procurement/approve')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ poIds: ['fake-po-id'] })
          .expect(403); // Forbidden - only L5 can approve

        expect(res.body.message).toContain('Forbidden');

        // Cleanup
        await prisma.client.user.delete({ where: { id: manager.id } });
      });
    });
  });
});
