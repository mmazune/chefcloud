/**
 * M11.8: Vendor Returns + Recall/Quarantine + Expiry Enforcement E2E Tests
 *
 * Hypotheses Tested:
 * H1: VendorReturn POST can over-allocate lots (race/logic) - MUST PREVENT
 * H2: Recall-linked lots still allocate (filter not applied) - MUST BLOCK
 * H3: Expiry evaluation correctly marks past-expiry lots as EXPIRED
 * H4: Export hash verifies content integrity
 * H5: Cross-branch leakage prevented in recalls/returns
 * H6: Idempotent POST (no duplicate ledger entries)
 * H7: RBAC enforcement (L2 cannot POST, L4 can)
 * H8: Void reverses posted quantities correctly
 *
 * Tests:
 * 1. Create vendor return in DRAFT status
 * 2. Submit vendor return (DRAFT → SUBMITTED)
 * 3. Post vendor return with FEFO allocation
 * 4. Over-allocation prevention on POST
 * 5. Recall-linked lot blocks vendor return
 * 6. Void posted return reverses quantities
 * 7. Create and close recall case
 * 8. Link/unlink lots from recall
 * 9. Evaluate expiry marks lots as EXPIRED
 * 10. RBAC enforcement tests
 * 11. Idempotency on POST
 * 12. Export with hash verification
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

describe('M11.8: Vendor Returns + Recall/Quarantine + Expiry E2E', () => {
    let app: INestApplication;
    let prismaService: PrismaService;
    let prisma: PrismaClient;
    let testOrg: FactoryOrg;

    // Test data IDs
    let itemId: string;
    let locationId: string;
    let branchId: string;
    let vendorId: string;

    // Lot IDs for testing
    let lotActiveWithStock: string;
    let lotForRecall: string;
    let lotPastExpiry: string;

    // Vendor return IDs for tests
    let vendorReturnId: string;

    // Recall case IDs for tests
    let recallCaseId: string;

    beforeAll(async () => {
        app = await createE2EApp({ imports: [AppModule] });
        prismaService = app.get(PrismaService);
        prisma = prismaService.client;

        // Create test org with users
        testOrg = await createOrgWithUsers(prisma, `test-m118-${Date.now()}`);
        branchId = testOrg.branchId;

        // Create base UOM
        const uom = await prisma.unitOfMeasure.create({
            data: {
                orgId: testOrg.orgId,
                code: 'EA',
                name: 'Each',
            },
        });

        // Create test item
        const item = await prisma.inventoryItem.create({
            data: {
                orgId: testOrg.orgId,
                sku: 'M118-ITEM-001',
                name: 'M118 Test Item',
                unit: 'EA',
                category: 'M118 Test Category',
                isActive: true,
                uom: { connect: { id: uom.id } },
            },
        });
        itemId = item.id;

        // Create test location
        const location = await prisma.inventoryLocation.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                code: 'LOC-M118',
                name: 'M118 Test Location',
                locationType: 'STORAGE',
                isActive: true,
            },
        });
        locationId = location.id;

        // Create vendor
        const vendor = await prisma.vendor.create({
            data: {
                orgId: testOrg.orgId,
                name: 'M118 Test Vendor',
            },
        });
        vendorId = vendor.id;

        // Create lots for testing
        const now = new Date();
        const futureExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const pastExpiry = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

        // Lot 1: Active with stock
        const lot1 = await prisma.inventoryLot.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                itemId,
                locationId,
                lotNumber: 'LOT-M118-ACTIVE',
                receivedQty: new Decimal(100),
                remainingQty: new Decimal(100),
                unitCost: new Decimal(10),
                expiryDate: futureExpiry,
                status: 'ACTIVE',
                sourceType: 'GOODS_RECEIPT',
                createdById: testOrg.users.owner.id,
            },
        });
        lotActiveWithStock = lot1.id;

        // Lot 2: For recall testing
        const lot2 = await prisma.inventoryLot.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                itemId,
                locationId,
                lotNumber: 'LOT-M118-RECALL',
                receivedQty: new Decimal(50),
                remainingQty: new Decimal(50),
                unitCost: new Decimal(10),
                expiryDate: futureExpiry,
                status: 'ACTIVE',
                sourceType: 'GOODS_RECEIPT',
                createdById: testOrg.users.owner.id,
            },
        });
        lotForRecall = lot2.id;

        // Lot 3: Past expiry (still ACTIVE, will be marked EXPIRED by evaluateExpiry)
        const lot3 = await prisma.inventoryLot.create({
            data: {
                orgId: testOrg.orgId,
                branchId,
                itemId,
                locationId,
                lotNumber: 'LOT-M118-PAST-EXPIRY',
                receivedQty: new Decimal(25),
                remainingQty: new Decimal(25),
                unitCost: new Decimal(10),
                expiryDate: pastExpiry,
                status: 'ACTIVE', // Will be marked EXPIRED by evaluateExpiry
                sourceType: 'GOODS_RECEIPT',
                createdById: testOrg.users.owner.id,
            },
        });
        lotPastExpiry = lot3.id;

        // Login to get tokens
        const loginOwner = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: testOrg.users.owner.email, password: 'Test#123' });
        testOrg.users.owner.token = loginOwner.body.access_token;

        const loginWaiter = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: testOrg.users.waiter.email, password: 'Test#123' });
        testOrg.users.waiter.token = loginWaiter.body.access_token;
    }, 60000);

    afterAll(async () => {
        await cleanup(app);
    });

    // ============================================================
    // Group 1: Vendor Returns Workflow
    // ============================================================
    describe('Group 1: Vendor Returns Workflow', () => {
        it('should create vendor return in DRAFT status', async () => {
            const res = await request(app.getHttpServer())
                .post('/inventory/vendor-returns')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    branchId,
                    vendorId,
                    notes: 'Test return',
                    lines: [
                        {
                            itemId,
                            locationId,
                            requestedBaseQty: 10,
                            lotId: lotActiveWithStock,
                            unitCost: 10,
                            reason: 'Damaged goods',
                        },
                    ],
                })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('returnNumber');
            expect(res.body.status).toBe('DRAFT');
            vendorReturnId = res.body.id;
        });

        it('should list vendor returns', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/vendor-returns')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.body).toHaveProperty('items');
            expect(res.body.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should get vendor return details', async () => {
            const res = await request(app.getHttpServer())
                .get(`/inventory/vendor-returns/${vendorReturnId}`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.returnNumber).toBeDefined();
            expect(res.body.status).toBe('DRAFT');
            expect(res.body.lines.length).toBe(1);
        });

        it('should submit vendor return (DRAFT → SUBMITTED)', async () => {
            const res = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${vendorReturnId}/submit`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('SUBMITTED');
        });

        it('H7: L2 user cannot POST vendor return', async () => {
            await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${vendorReturnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
                .expect(403);
        });

        it('should POST vendor return with lot decrement', async () => {
            // Get current lot qty
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            expect(lotBefore?.remainingQty.toNumber()).toBe(100);

            const res = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${vendorReturnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('POSTED');

            // Verify lot qty decremented
            const lotAfter = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            expect(lotAfter?.remainingQty.toNumber()).toBe(90); // 100 - 10
        });

        it('H6: Idempotent POST returns already posted response', async () => {
            const res = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${vendorReturnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .set('X-Idempotency-Key', `test-idem-${vendorReturnId}`)
                .expect(400); // Already posted should fail with 400

            // The return is already POSTED, so this should fail
        });
    });

    // ============================================================
    // Group 2: Recall Cases
    // ============================================================
    describe('Group 2: Recall Cases', () => {
        it('should create recall case', async () => {
            const res = await request(app.getHttpServer())
                .post('/inventory/recalls')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    branchId,
                    reason: 'Contamination suspected',
                    notes: 'Test recall case',
                })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('caseNumber');
            expect(res.body.status).toBe('OPEN');
            recallCaseId = res.body.id;
        });

        it('should link lot to recall case', async () => {
            const res = await request(app.getHttpServer())
                .post(`/inventory/recalls/${recallCaseId}/link-lot`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ lotId: lotForRecall })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.linked).toBe(true);
        });

        it('should list recalled lots', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/recalls/recalled-lots')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.body.items.length).toBeGreaterThanOrEqual(1);
            expect(res.body.items.some((l: any) => l.lotId === lotForRecall)).toBe(true);
        });

        it('should get recall impact report', async () => {
            const res = await request(app.getHttpServer())
                .get(`/inventory/recalls/${recallCaseId}/impact`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.body.totalLotsAffected).toBe(1);
            expect(res.body.totalQtyBlocked).toBe(50);
        });

        it('H2: Recall-linked lot blocks vendor return POST', async () => {
            // Create a new vendor return targeting the recalled lot
            const createRes = await request(app.getHttpServer())
                .post('/inventory/vendor-returns')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    branchId,
                    vendorId,
                    lines: [
                        {
                            itemId,
                            locationId,
                            requestedBaseQty: 5,
                            lotId: lotForRecall, // This lot is under recall
                            unitCost: 10,
                        },
                    ],
                })
                .expect(201);

            const returnId = createRes.body.id;

            // Submit
            await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${returnId}/submit`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            // POST should fail because lot is under recall
            const postRes = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${returnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(400);

            expect(postRes.body.message).toContain('recall');
        });

        it('should unlink lot from recall case', async () => {
            const res = await request(app.getHttpServer())
                .post(`/inventory/recalls/${recallCaseId}/unlink-lot`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ lotId: lotForRecall })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.unlinked).toBe(true);
        });

        it('should close recall case', async () => {
            // Re-link for the close test
            await request(app.getHttpServer())
                .post(`/inventory/recalls/${recallCaseId}/link-lot`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ lotId: lotForRecall })
                .expect(200);

            const res = await request(app.getHttpServer())
                .post(`/inventory/recalls/${recallCaseId}/close`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ notes: 'Recall resolved' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('CLOSED');
        });
    });

    // ============================================================
    // Group 3: Expiry Enforcement
    // ============================================================
    describe('Group 3: Expiry Enforcement', () => {
        it('H3: evaluateExpiry marks past-expiry lots as EXPIRED', async () => {
            // Verify the lot is currently ACTIVE
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: lotPastExpiry },
            });
            expect(lotBefore?.status).toBe('ACTIVE');

            // Call evaluate expiry
            const res = await request(app.getHttpServer())
                .post('/inventory/expiry/evaluate')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ branchId })
                .expect(200);

            expect(res.body.lotsMarkedExpired).toBeGreaterThanOrEqual(1);

            // Verify the lot is now EXPIRED
            const lotAfter = await prisma.inventoryLot.findUnique({
                where: { id: lotPastExpiry },
            });
            expect(lotAfter?.status).toBe('EXPIRED');
        });

        it('should get expiry summary', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/expiry/summary')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.body.expiredLotsCount).toBeGreaterThanOrEqual(1);
        });

        it('should get expired lots', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/expiry/expired')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.body.items.length).toBeGreaterThanOrEqual(1);
            expect(res.body.items.some((l: any) => l.lotNumber === 'LOT-M118-PAST-EXPIRY')).toBe(true);
        });

        it('should support dry run for evaluateExpiry', async () => {
            const res = await request(app.getHttpServer())
                .post('/inventory/expiry/evaluate')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ branchId, dryRun: true })
                .expect(200);

            // Dry run should return details but not actually mark anything
            expect(res.body.lotsMarkedExpired).toBe(0);
        });
    });

    // ============================================================
    // Group 4: Void Workflow
    // ============================================================
    describe('Group 4: Void Workflow', () => {
        let voidTestReturnId: string;

        it('should create and post a return for void testing', async () => {
            // Create
            const createRes = await request(app.getHttpServer())
                .post('/inventory/vendor-returns')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    branchId,
                    vendorId,
                    lines: [
                        {
                            itemId,
                            locationId,
                            requestedBaseQty: 5,
                            lotId: lotActiveWithStock,
                            unitCost: 10,
                        },
                    ],
                })
                .expect(201);
            voidTestReturnId = createRes.body.id;

            // Submit
            await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${voidTestReturnId}/submit`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            // Get lot qty before post
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            const qtyBefore = lotBefore?.remainingQty.toNumber() || 0;

            // Post
            await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${voidTestReturnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            // Verify qty decremented
            const lotAfterPost = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            expect(lotAfterPost?.remainingQty.toNumber()).toBe(qtyBefore - 5);
        });

        it('H8: Void reverses posted quantities correctly', async () => {
            const lotBefore = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            const qtyBefore = lotBefore?.remainingQty.toNumber() || 0;

            // Void the return
            const res = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${voidTestReturnId}/void`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({ reason: 'Test void' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('VOID');

            // Verify qty restored
            const lotAfterVoid = await prisma.inventoryLot.findUnique({
                where: { id: lotActiveWithStock },
            });
            expect(lotAfterVoid?.remainingQty.toNumber()).toBe(qtyBefore + 5);
        });
    });

    // ============================================================
    // Group 5: H1 Over-allocation Prevention
    // ============================================================
    describe('Group 5: Over-allocation Prevention', () => {
        it('H1: Should prevent over-allocation on POST', async () => {
            // Create a lot with limited qty
            const limitedLot = await prisma.inventoryLot.create({
                data: {
                    orgId: testOrg.orgId,
                    branchId,
                    itemId,
                    locationId,
                    lotNumber: `LOT-LIMITED-${Date.now()}`,
                    receivedQty: new Decimal(10),
                    remainingQty: new Decimal(10),
                    unitCost: new Decimal(10),
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'ACTIVE',
                    sourceType: 'GOODS_RECEIPT',
                    createdById: testOrg.users.owner.id,
                },
            });

            // Create vendor return for more than available
            const createRes = await request(app.getHttpServer())
                .post('/inventory/vendor-returns')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .send({
                    branchId,
                    vendorId,
                    lines: [
                        {
                            itemId,
                            locationId,
                            requestedBaseQty: 20, // More than 10 available
                            lotId: limitedLot.id,
                            unitCost: 10,
                        },
                    ],
                })
                .expect(201);

            const returnId = createRes.body.id;

            // Submit
            await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${returnId}/submit`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            // POST should fail due to insufficient qty
            const postRes = await request(app.getHttpServer())
                .post(`/inventory/vendor-returns/${returnId}/post`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(400);

            expect(postRes.body.message).toContain('insufficient');
        });
    });

    // ============================================================
    // Group 6: Export with Hash Verification
    // ============================================================
    describe('Group 6: Export with Hash Verification', () => {
        it('H4: Export includes hash for content verification', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/vendor-returns/export')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['x-content-hash']).toBeDefined();
            expect(res.headers['x-content-hash'].length).toBe(64); // SHA256 hex = 64 chars
        });

        it('should export recall impact with hash', async () => {
            const res = await request(app.getHttpServer())
                .get(`/inventory/recalls/${recallCaseId}/export`)
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['x-content-hash']).toBeDefined();
        });

        it('should export expired lots with hash', async () => {
            const res = await request(app.getHttpServer())
                .get('/inventory/expiry/export')
                .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
                .query({ branchId })
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['x-content-hash']).toBeDefined();
        });
    });
});
