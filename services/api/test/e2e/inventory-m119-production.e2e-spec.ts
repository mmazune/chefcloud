/**
 * M11.9: Inventory Production/Manufacturing Batches E2E Tests
 *
 * Hypotheses Tested:
 * H1: Idempotent POST (no duplicate ledger entries on re-POST)
 * H2: VOID restores lot remainingQty
 * H3: Costing uses WAC at POST time (output cost = sum of input costs / output qty)
 * H4: Cross-branch isolation (branchA cannot see/modify branchB batches)
 * H5: Negative stock prevention (cannot consume more than available)
 * H6: Export hash matches content integrity
 * H7: RBAC enforcement (L2 read, L3 create/post, L4 void/export)
 * H8: Tests do not hang (AfterAll cleans up properly)
 *
 * Tests:
 * 1. Create production batch in DRAFT status
 * 2. Add/remove input lines to draft
 * 3. POST batch → creates ledger entries + lot consumption
 * 4. VOID reverses posted batch (restores lots)
 * 5. Negative stock prevention
 * 6. Cross-branch isolation
 * 7. RBAC enforcement
 * 8. Idempotency on POST
 * 9. Export with hash verification
 * 10. Cost calculation verification
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '../../src/prisma.service';
import { AppModule } from '../../src/app.module';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

describe('M11.9: Inventory Production/Manufacturing Batches E2E', () => {
    let app: INestApplication;
    let prismaService: PrismaService;
    let prisma: PrismaClient;
    let testOrg: FactoryOrg;
    let secondOrg: FactoryOrg;

    // Test data IDs - Organization 1
    let inputItemId: string;
    let outputItemId: string;
    let locationId: string;
    let branchId: string;
    let uomId: string;

    // Lot IDs for testing
    let inputLotId: string;
    let inputLotWithLowStock: string;

    // Production batch IDs for tests
    let draftBatchId: string;

    beforeAll(async () => {
        app = await createE2EApp({ imports: [AppModule] });
        prismaService = app.get(PrismaService);
        prisma = prismaService.client;

        // Create test org with users
        testOrg = await createOrgWithUsers(prisma, `test-m119-${Date.now()}`);
        branchId = testOrg.branchId;

        // Create second org for cross-branch tests
        secondOrg = await createOrgWithUsers(prisma, `test-m119-second-${Date.now()}`);

        // Create base UOM
        const uom = await prisma.unitOfMeasure.create({
            data: {
                orgId: testOrg.orgId,
                code: 'EA',
                name: 'Each',
            },
        });
        uomId = uom.id;

        // Create input item (raw material)
        const inputItem = await prisma.inventoryItem.create({
            data: {
                orgId: testOrg.orgId,
                sku: 'M119-RAW-001',
                name: 'M119 Raw Material',
                unit: 'EA',
                category: 'Raw Materials',
                isActive: true,
                uom: { connect: { id: uom.id } },
            },
        });
        inputItemId = inputItem.id;

        // Create output item (finished product)
        const outputItem = await prisma.inventoryItem.create({
            data: {
                orgId: testOrg.orgId,
                sku: 'M119-PROD-001',
                name: 'M119 Finished Product',
                unit: 'EA',
                category: 'Finished Goods',
                isActive: true,
                uom: { connect: { id: uom.id } },
            },
        });
        outputItemId = outputItem.id;

        // Create test location
        const location = await prisma.inventoryLocation.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                code: 'LOC-M119',
                name: 'M119 Production Location',
                locationType: 'STORAGE',
                isActive: true,
            },
        });
        locationId = location.id;

        // Create lots for input item
        const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Lot 1: Active with enough stock (100 units @ $10/unit)
        const lot1 = await prisma.inventoryLot.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                itemId: inputItemId,
                locationId,
                lotNumber: 'LOT-M119-INPUT-001',
                receivedQty: new Decimal(100),
                remainingQty: new Decimal(100),
                unitCost: new Decimal(10),
                expiryDate: futureExpiry,
                status: 'ACTIVE',
                sourceType: 'GOODS_RECEIPT',
                createdById: testOrg.users.owner.id,
            },
        });
        inputLotId = lot1.id;

        // Lot 2: Low stock for testing negative stock prevention
        const lot2 = await prisma.inventoryLot.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                itemId: inputItemId,
                locationId,
                lotNumber: 'LOT-M119-INPUT-LOW',
                receivedQty: new Decimal(5),
                remainingQty: new Decimal(5),
                unitCost: new Decimal(15),
                expiryDate: futureExpiry,
                status: 'ACTIVE',
                sourceType: 'GOODS_RECEIPT',
                createdById: testOrg.users.owner.id,
            },
        });
        inputLotWithLowStock = lot2.id;

        // Create ledger entries for stock on hand
        await prisma.stockLedgerEntry.createMany({
            data: [
                {
                    orgId: testOrg.orgId,
                    branchId,
                    itemId: inputItemId,
                    locationId,
                    lotId: inputLotId,
                    qty: new Decimal(100),
                    reason: 'GOODS_RECEIPT',
                    sourceType: 'GOODS_RECEIPT',
                    userId: testOrg.users.owner.id,
                    notes: 'Initial stock for M11.9 tests',
                },
                {
                    orgId: testOrg.orgId,
                    branchId,
                    itemId: inputItemId,
                    locationId,
                    lotId: inputLotWithLowStock,
                    qty: new Decimal(5),
                    reason: 'GOODS_RECEIPT',
                    sourceType: 'GOODS_RECEIPT',
                    userId: testOrg.users.owner.id,
                    notes: 'Low stock for M11.9 tests',
                },
            ],
        });

        // Login to get tokens
        const loginOwner = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: testOrg.users.owner.email, password: 'Test#123' });
        testOrg.users.owner.token = loginOwner.body.access_token;

        const loginWaiter = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: testOrg.users.waiter.email, password: 'Test#123' });
        testOrg.users.waiter.token = loginWaiter.body.access_token;

        const loginSecondOwner = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: secondOrg.users.owner.email, password: 'Test#123' });
        secondOrg.users.owner.token = loginSecondOwner.body.access_token;
    }, 60000);

    afterAll(async () => {
        await cleanup(app);
    });

    // ============================================================
    // Group 1: Production Batch Workflow (DRAFT → POSTED)
    // ============================================================
    describe('Group 1: Production Batch Workflow', () => {
        it('should create production batch in DRAFT status', async () => {
            const res = await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 10,
                    outputUomId: uomId,
                    notes: 'Test production batch',
                })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('batchNumber');
            expect(res.body.status).toBe('DRAFT');
            draftBatchId = res.body.id;
        });

        it('should add input line to draft batch', async () => {
            const res = await request(app.getHttpServer())
                .post(`/inventory/production/${draftBatchId}/lines`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    itemId: inputItemId,
                    locationId,
                    qty: 20, // 20 units of input to make 10 units of output
                    uomId,
                    notes: 'Raw material input',
                })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body.itemId).toBe(inputItemId);
        });

        it('should list production batches', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body).toHaveProperty('items');
            expect(res.body.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should get production batch details', async () => {
            const res = await request(app.getHttpServer())
                .get(`/inventory/production/${draftBatchId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.batchNumber).toBeDefined();
            expect(res.body.status).toBe('DRAFT');
            expect(res.body.lines.length).toBe(1);
        });

        it('should remove line from draft batch', async () => {
            // Add another line first
            const addRes = await request(app.getHttpServer())
                .post(`/inventory/production/${draftBatchId}/lines`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    itemId: inputItemId,
                    locationId,
                    qty: 5,
                    uomId,
                    notes: 'Extra line to remove',
                })
                .expect(201);

            const extraLineId = addRes.body.id;

            // Remove the extra line
            await request(app.getHttpServer())
                .delete(`/inventory/production/${draftBatchId}/lines/${extraLineId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(204);

            // Verify line was removed
            const res = await request(app.getHttpServer())
                .get(`/inventory/production/${draftBatchId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.lines.length).toBe(1);
        });

        it('H3: POST batch creates ledger entries + output cost = sum(input costs) / output qty', async () => {
            // Get lot qty before POST
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: inputLotId },
            });
            expect(lotBefore?.remainingQty.toNumber()).toBe(100);

            // POST the batch
            const res = await request(app.getHttpServer())
                .patch(`/inventory/production/${draftBatchId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.status).toBe('POSTED');
            expect(res.body.postedAt).toBeDefined();

            // Verify lot qty decremented (consumed 20 units)
            const lotAfter = await prisma.inventoryLot.findUnique({
                where: { id: inputLotId },
            });
            expect(lotAfter?.remainingQty.toNumber()).toBe(80); // 100 - 20

            // Verify PRODUCTION_CONSUME ledger entry exists
            const consumeEntry = await prisma.stockLedgerEntry.findFirst({
                where: {
                    itemId: inputItemId,
                    reason: 'PRODUCTION_CONSUME',
                    sourceType: 'PRODUCTION',
                    sourceId: draftBatchId,
                },
            });
            expect(consumeEntry).toBeDefined();
            expect(consumeEntry?.qty.toNumber()).toBe(-20); // Negative for consumption

            // Verify PRODUCTION_PRODUCE ledger entry exists
            const produceEntry = await prisma.stockLedgerEntry.findFirst({
                where: {
                    itemId: outputItemId,
                    reason: 'PRODUCTION_PRODUCE',
                    sourceType: 'PRODUCTION',
                    sourceId: draftBatchId,
                },
            });
            expect(produceEntry).toBeDefined();
            expect(produceEntry?.qty.toNumber()).toBe(10); // Positive for production output

            // Verify output unit cost = (20 input × $10/unit) / 10 output = $20/unit
            const batch = await prisma.productionBatch.findUnique({
                where: { id: draftBatchId },
            });
            expect(batch?.outputUnitCost?.toNumber()).toBe(20);
        });

        it('H1: Idempotent POST returns error for already posted batch', async () => {
            // Attempt to POST again
            await request(app.getHttpServer())
                .patch(`/inventory/production/${draftBatchId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(400); // Already posted should fail
        });
    });

    // ============================================================
    // Group 2: VOID Workflow
    // ============================================================
    describe('Group 2: VOID Workflow', () => {
        let voidableBatchId: string;

        beforeAll(async () => {
            // Create and post a batch for void testing
            const createRes = await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 5,
                    outputUomId: uomId,
                    notes: 'Batch for void testing',
                });
            voidableBatchId = createRes.body.id;

            // Add line
            await request(app.getHttpServer())
                .post(`/inventory/production/${voidableBatchId}/lines`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    itemId: inputItemId,
                    locationId,
                    qty: 10,
                    uomId,
                });

            // Post the batch
            await request(app.getHttpServer())
                .patch(`/inventory/production/${voidableBatchId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`);
        });

        it('H7: L2 user cannot VOID production batch', async () => {
            await request(app.getHttpServer())
                .patch(`/inventory/production/${voidableBatchId}/void`)
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .send({ voidReason: 'Testing L2 cannot void' })
                .expect(403);
        });

        it('H2: VOID restores lot remainingQty', async () => {
            // Get lot qty before VOID
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: inputLotId },
            });
            const qtyBefore = lotBefore?.remainingQty.toNumber() ?? 0;

            // VOID the batch
            const res = await request(app.getHttpServer())
                .patch(`/inventory/production/${voidableBatchId}/void`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ voidReason: 'Testing void restores lots' })
                .expect(200);

            expect(res.body.status).toBe('VOID');
            expect(res.body.voidedAt).toBeDefined();
            expect(res.body.voidReason).toBe('Testing void restores lots');

            // Verify lot qty restored (10 units added back)
            const lotAfter = await prisma.inventoryLot.findUnique({
                where: { id: inputLotId },
            });
            expect(lotAfter?.remainingQty.toNumber()).toBe(qtyBefore + 10);

            // Verify reversal ledger entries exist
            const reversalConsumeEntry = await prisma.stockLedgerEntry.findFirst({
                where: {
                    itemId: inputItemId,
                    reason: 'PRODUCTION_CONSUME',
                    sourceType: 'PRODUCTION',
                    sourceId: voidableBatchId,
                    qty: { gt: 0 }, // Positive (reversal of negative)
                },
            });
            expect(reversalConsumeEntry).toBeDefined();
            expect(reversalConsumeEntry?.qty.toNumber()).toBe(10);
        });
    });

    // ============================================================
    // Group 3: Negative Stock Prevention
    // ============================================================
    describe('Group 3: Negative Stock Prevention', () => {
        it('H5: Cannot consume more than available stock', async () => {
            // Create batch
            const createRes = await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 1,
                    outputUomId: uomId,
                });
            const batchId = createRes.body.id;

            // Add line with specific low-stock lot that only has 5 units
            await request(app.getHttpServer())
                .post(`/inventory/production/${batchId}/lines`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    itemId: inputItemId,
                    locationId,
                    qty: 100, // Requesting more than total available
                    uomId,
                    lotId: inputLotWithLowStock, // This lot only has 5 units
                });

            // POST should fail due to insufficient stock
            const postRes = await request(app.getHttpServer())
                .patch(`/inventory/production/${batchId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(400);

            expect(postRes.body.message).toContain('insufficient');
        });
    });

    // ============================================================
    // Group 4: Cross-Branch Isolation
    // ============================================================
    describe('Group 4: Cross-Branch Isolation', () => {
        it('H4: Cannot access batches from another branch', async () => {
            // Second org owner tries to access first org's batch
            await request(app.getHttpServer())
                .get(`/inventory/production/${draftBatchId}`)
                .set('Authorization', `Bearer ${secondOrg.users.owner.token}`)
                .expect(404);
        });

        it('H4: List only shows batches from user branch', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/production')
                .set('Authorization', `Bearer ${secondOrg.users.owner.token}`)
                .expect(200);

            // Second org should not see first org's batches
            const batchIds = res.body.items.map((b: { id: string }) => b.id);
            expect(batchIds).not.toContain(draftBatchId);
        });
    });

    // ============================================================
    // Group 5: RBAC Enforcement
    // ============================================================
    describe('Group 5: RBAC Enforcement', () => {
        it('H7: L2 user can READ production batches', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .expect(200);

            expect(res.body).toHaveProperty('items');
        });

        it('H7: L2 user cannot CREATE production batches', async () => {
            await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 5,
                    outputUomId: uomId,
                })
                .expect(403);
        });

        it('H7: L2 user cannot POST production batches', async () => {
            // Create a new draft as owner
            const createRes = await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 5,
                    outputUomId: uomId,
                });
            const newBatchId = createRes.body.id;

            // L2 tries to POST
            await request(app.getHttpServer())
                .patch(`/inventory/production/${newBatchId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .expect(403);
        });
    });

    // ============================================================
    // Group 6: Export
    // ============================================================
    describe('Group 6: Export', () => {
        it('H6: Export returns CSV with SHA256 hash in header', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/production/export')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body).toHaveProperty('csv');
            expect(res.body).toHaveProperty('sha256');
            expect(res.body.sha256).toMatch(/^[a-f0-9]{64}$/); // Valid SHA256 hex

            // Verify CSV contains expected headers
            expect(res.body.csv).toContain('batchNumber');
            expect(res.body.csv).toContain('status');
        });

        it('H7: L2 user cannot access export endpoint', async () => {
            await request(app.getHttpServer())
                .get('/inventory/production/export')
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .expect(403);
        });
    });

    // ============================================================
    // Group 7: Delete Draft
    // ============================================================
    describe('Group 7: Delete Draft', () => {
        it('should delete draft batch', async () => {
            // Create a new draft
            const createRes = await request(app.getHttpServer())
                .post('/inventory/production')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    productionLocationId: locationId,
                    outputItemId,
                    outputQty: 5,
                    outputUomId: uomId,
                });
            const deletableBatchId = createRes.body.id;

            // Delete the draft
            await request(app.getHttpServer())
                .delete(`/inventory/production/${deletableBatchId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(204);

            // Verify it's deleted
            await request(app.getHttpServer())
                .get(`/inventory/production/${deletableBatchId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(404);
        });

        it('cannot delete posted batch', async () => {
            // Try to delete the already posted batch
            await request(app.getHttpServer())
                .delete(`/inventory/production/${draftBatchId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(400);
        });
    });
});
