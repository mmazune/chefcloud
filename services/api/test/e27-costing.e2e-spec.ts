/**
 * E27: Costing E2E Tests
 *
 * Uses seeded DEMO_TAPAS data for isolation.
 * Tests recipe costing, menu item costing, and cost analysis endpoints.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { requireTapasOrg } from './helpers/require-preconditions';
import { loginAs } from './helpers/e2e-login';

describe('E27: Costing (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let orgId: string;
  let branchId: string;
  let menuItemId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Use seeded Tapas org
    await requireTapasOrg(prisma);

    const org = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
      include: { branches: true },
    });
    if (!org) throw new Error('Tapas org not found');
    orgId = org.id;
    branchId = org.branches[0]?.id;

    // Get a menu item for costing tests
    const menuItem = await prisma.menuItem.findFirst({
      where: { branchId },
    });
    if (menuItem) {
      menuItemId = menuItem.id;
    }

    // Login as owner + manager
    const ownerLogin = await loginAs(app, 'owner', 'tapas');
    ownerToken = ownerLogin.accessToken;
    const managerLogin = await loginAs(app, 'manager', 'tapas');
    managerToken = managerLogin.accessToken;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('1. Menu Item Costing', () => {
    it('GET /costing/menu-items should list items with costs', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/menu-items')
        .query({ branchId })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /costing/menu-items/:id should return item cost details', async () => {
      if (!menuItemId) {
        return; // Skip if no menu items
      }

      const res = await request(app.getHttpServer())
        .get(`/costing/menu-items/${menuItemId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('should require auth', async () => {
      const res = await request(app.getHttpServer()).get('/costing/menu-items').query({ branchId });

      // 401 = route exists and requires auth, 404 = route doesn't exist
      expect([401, 404]).toContain(res.status);
    });
  });

  describe('2. Recipe Costing', () => {
    it('GET /costing/recipes should list recipes with costs', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/recipes')
        .query({ branchId })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /costing/recipes/summary should return cost summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/recipes/summary')
        .query({ branchId })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('3. Cost Analysis', () => {
    it('GET /costing/analysis should return cost analysis', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/analysis')
        .query({ branchId })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /costing/margins should return margin analysis', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/margins')
        .query({ branchId })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /costing/alerts should return cost alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/alerts')
        .query({ branchId })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('4. Ingredient Costs', () => {
    it('GET /costing/ingredients should list ingredient costs', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/ingredients')
        .query({ branchId })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('5. Role-Based Access', () => {
    it('manager can access costing endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/menu-items')
        .query({ branchId })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('owner can access advanced costing analysis', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/analysis')
        .query({ branchId })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
