/**
 * Multi-Tenant Isolation E2E Tests
 *
 * Tests cross-org data isolation using seeded demo datasets:
 * - Org A: DEMO_TAPAS (tapas-demo)
 * - Org B: DEMO_CAFESSERIE (cafesserie-demo)
 *
 * Verifies that users from one org cannot access data from another org.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { loginAs } from './helpers/e2e-login';
import { requireTapasOrg, requireCafesserieFranchise } from './helpers/require-preconditions';

describe('Multi-Tenant Isolation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Org A (Tapas) entities
  let orgAId: string;
  let branchAId: string;
  let tokenA: string;
  let menuItemAId: string;

  // Org B (Cafesserie) entities
  let orgBId: string;
  let branchBId: string;
  let tokenB: string;
  let menuItemBId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Validate preconditions
    await requireTapasOrg(prisma);
    await requireCafesserieFranchise(prisma, { minBranches: 1 });

    // Get Org A (Tapas)
    const orgA = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
      include: { branches: true },
    });
    if (!orgA) throw new Error('Tapas org not found after precondition check');
    orgAId = orgA.id;
    branchAId = orgA.branches[0].id;

    // Get Org B (Cafesserie)
    const orgB = await prisma.org.findFirst({
      where: { slug: 'cafesserie-demo' },
      include: { branches: true },
    });
    if (!orgB) throw new Error('Cafesserie org not found after precondition check');
    orgBId = orgB.id;
    branchBId = orgB.branches[0].id;

    // Login as owners in both orgs
    const loginA = await loginAs(app, 'owner', 'tapas');
    tokenA = loginA.accessToken;

    const loginB = await loginAs(app, 'owner', 'cafesserie');
    tokenB = loginB.accessToken;

    // Get sample menu items from each org (filter by branch, not org - MenuItem has branchId)
    const menuItemA = await prisma.menuItem.findFirst({
      where: { branchId: branchAId },
    });
    if (!menuItemA) throw new Error('Tapas org must have at least 1 menu item');
    menuItemAId = menuItemA.id;

    const menuItemB = await prisma.menuItem.findFirst({
      where: { branchId: branchBId },
    });
    if (!menuItemB) throw new Error('Cafesserie org must have at least 1 menu item');
    menuItemBId = menuItemB.id;

    // Suppress unused variable warnings
    void branchAId;
    void branchBId;
  });

  afterAll(async () => {
    // No cleanup needed - using seeded read-only data
    await cleanup(app);
  });

  describe('Cross-org menu item access', () => {
    it('should deny user A access to org B menu items with wrong x-org-id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgBId)
        .expect(403);

      expect(response.body.message).toContain('denied');
    });

    it('should return 404 or 403 when user A requests org B resource with correct x-org-id', async () => {
      // User A with correct x-org-id should not see org B data
      // 404 = item not found in their org, 403 = tenant isolation denied
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgAId);

      expect([403, 404]).toContain(response.status);
      // Ensure no data leakage
      expect(response.body).not.toHaveProperty('price');
      expect(response.body).not.toHaveProperty('name');
    });

    it('should allow user A to access org A menu items', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgAId)
        .expect(200);

      expect(response.body.id).toBe(menuItemAId);
    });

    it('should require x-org-id header', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.message).toContain('x-org-id');
    });
  });

  describe('Cross-org data isolation', () => {
    it('should not leak org B data when user A lists menu items', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgAId)
        .expect(200);

      expect(Array.isArray(response.body.data || response.body)).toBe(true);

      const items = response.body.data || response.body;
      // Should not see any org B items
      const orgBItems = items.filter((item: any) => item.orgId === orgBId);
      expect(orgBItems).toHaveLength(0);
    });

    it('should isolate org B user from org A data', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-org-id', orgBId)
        .expect(200);

      expect(Array.isArray(response.body.data || response.body)).toBe(true);

      const items = response.body.data || response.body;
      // Should not see any org A items
      const orgAItems = items.filter((item: any) => item.orgId === orgAId);
      expect(orgAItems).toHaveLength(0);
    });
  });
});
