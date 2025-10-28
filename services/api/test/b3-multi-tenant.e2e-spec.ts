import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Multi-Tenant Isolation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Org A entities
  let orgA: any;
  let branchA: any;
  let userA: any;
  let sessionA: any;
  let menuItemA: any;

  // Org B entities
  let orgB: any;
  let branchB: any;
  let userB: any;
  let sessionB: any;
  let menuItemB: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Seed Org A
    orgA = await prisma.org.create({
      data: {
        name: 'Organization A',
        slug: `org-a-${Date.now()}`,
      },
    });

    branchA = await prisma.branch.create({
      data: {
        orgId: orgA.id,
        name: 'Branch A',
        address: '123 Street A',
      },
    });

    userA = await prisma.user.create({
      data: {
        orgId: orgA.id,
        branchId: branchA.id,
        email: `user-a-${Date.now()}@test.com`,
        firstName: 'User',
        lastName: 'A',
        roleLevel: 'L4',
        isActive: true,
      },
    });

    sessionA = await prisma.session.create({
      data: {
        userId: userA.id,
        token: `token-a-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const categoryA = await prisma.category.create({
      data: {
        branchId: branchA.id,
        name: 'Category A',
        sortOrder: 1,
        isActive: true,
      },
    });

    menuItemA = await prisma.client.menuItem.create({
      data: {
        branchId: branchA.id,
        categoryId: categoryA.id,
        name: 'Org A Special Item',
        itemType: 'FOOD',
        station: 'GRILL',
        price: 10000,
        isAvailable: true,
      },
    });

    // Seed Org B
    orgB = await prisma.org.create({
      data: {
        name: 'Organization B',
        slug: `org-b-${Date.now()}`,
      },
    });

    branchB = await prisma.branch.create({
      data: {
        orgId: orgB.id,
        name: 'Branch B',
        address: '456 Street B',
      },
    });

    userB = await prisma.user.create({
      data: {
        orgId: orgB.id,
        branchId: branchB.id,
        email: `user-b-${Date.now()}@test.com`,
        firstName: 'User',
        lastName: 'B',
        roleLevel: 'L4',
        isActive: true,
      },
    });

    sessionB = await prisma.session.create({
      data: {
        userId: userB.id,
        token: `token-b-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const categoryB = await prisma.category.create({
      data: {
        branchId: branchB.id,
        name: 'Category B',
        sortOrder: 1,
        isActive: true,
      },
    });

    menuItemB = await prisma.client.menuItem.create({
      data: {
        branchId: branchB.id,
        categoryId: categoryB.id,
        name: 'Org B Special Item',
        itemType: 'FOOD',
        station: 'GRILL',
        price: 15000,
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup in reverse order
    await prisma.client.menuItem.deleteMany({ where: { branchId: branchA.id } });
    await prisma.client.menuItem.deleteMany({ where: { branchId: branchB.id } });
    await prisma.category.deleteMany({ where: { branchId: branchA.id } });
    await prisma.category.deleteMany({ where: { branchId: branchB.id } });
    await prisma.session.deleteMany({ where: { userId: userA.id } });
    await prisma.session.deleteMany({ where: { userId: userB.id } });
    await prisma.user.deleteMany({ where: { orgId: orgA.id } });
    await prisma.user.deleteMany({ where: { orgId: orgB.id } });
    await prisma.branch.deleteMany({ where: { orgId: orgA.id } });
    await prisma.branch.deleteMany({ where: { orgId: orgB.id } });
    await prisma.org.deleteMany({ where: { id: orgA.id } });
    await prisma.org.deleteMany({ where: { id: orgB.id } });
    await app.close();
  });

  describe('Cross-org menu item access', () => {
    it('should deny user A access to org B menu items with wrong x-org-id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemB.id}`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('x-org-id', orgB.id)
        .expect(403);

      expect(response.body.message).toContain('Access to this organization is denied');
    });

    it('should return 404 when user A requests org B resource with correct x-org-id', async () => {
      // User A with correct x-org-id should not see org B data
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemB.id}`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('x-org-id', orgA.id)
        .expect(404);

      // Ensure no data leakage
      expect(response.body).not.toHaveProperty('price');
      expect(response.body).not.toHaveProperty('name');
    });

    it('should allow user A to access org A menu items', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemA.id}`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('x-org-id', orgA.id)
        .expect(200);

      expect(response.body.id).toBe(menuItemA.id);
      expect(response.body.name).toBe('Org A Special Item');
    });

    it('should require x-org-id header', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemA.id}`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(400);

      expect(response.body.message).toContain('Missing x-org-id header');
    });
  });

  describe('Cross-org data isolation', () => {
    it('should not leak org B data when user A lists menu items', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('x-org-id', orgA.id)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Should only see org A items
      const orgBItems = response.body.filter((item: any) => item.branchId === branchB.id);
      expect(orgBItems).toHaveLength(0);

      // Should see org A items
      const orgAItems = response.body.filter((item: any) => item.branchId === branchA.id);
      expect(orgAItems.length).toBeGreaterThan(0);
    });

    it('should isolate org B user from org A data', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .set('x-org-id', orgB.id)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Should only see org B items
      const orgAItems = response.body.filter((item: any) => item.branchId === branchA.id);
      expect(orgAItems).toHaveLength(0);

      // Should see org B items
      const orgBItems = response.body.filter((item: any) => item.branchId === branchB.id);
      expect(orgBItems.length).toBeGreaterThan(0);
    });
  });
});
