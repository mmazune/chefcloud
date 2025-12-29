import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { E2eAppModule } from './e2e-app.module';
import { PrismaService } from '../src/prisma.service';
import { createHash } from 'crypto';
import { E2E_USERS } from './helpers/e2e-credentials';

/**
 * M30-OPS-S4: MSR Card Service E2E Smoke Tests
 *
 * Purpose: Verify MSR card functionality works end-to-end
 * - Card assignment
 * - Card authentication (MSR swipe)
 * - Card revocation
 * - Card lifecycle management
 *
 * This suite ensures MSR module is stable and doesn't break E2E execution.
 */
describe('MSR Card Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let branchId: string;
  let employeeId: string;
  let cardId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Login as owner to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: E2E_USERS.owner.email,
        password: E2E_USERS.owner.password,
      })
      .expect(200); // Ensure login succeeds

    ownerToken = loginResponse.body.access_token;
    orgId = loginResponse.body.user?.orgId || loginResponse.body.user?.org?.id; // Handle both formats
    branchId = loginResponse.body.user?.branchId || loginResponse.body.user?.branch?.id; // Handle both formats

    if (!orgId || !branchId) {
      throw new Error(`Login succeeded but missing orgId/branchId. Response: ${JSON.stringify(loginResponse.body)}`);
    }

    // Get an employee from seeded data
    const employee = await prisma.client.employee.findFirst({
      where: {
        orgId,
        status: 'ACTIVE',
        msrCard: null, // Employee without MSR card
      },
    });

    if (!employee) {
      // Create a test employee if none available
      const user = await prisma.client.user.create({
        data: {
          email: `test-msr-employee-${Date.now()}@demo.local`,
          password: 'hashed', // Not used for MSR
          firstName: 'MSR',
          lastName: 'TestEmployee',
          roleLevel: 'L2',
          orgId,
          branchId,
          isActive: true,
        },
      });

      const createdEmployee = await prisma.client.employee.create({
        data: {
          orgId,
          branchId,
          userId: user.id,
          employeeCode: `MSR${Date.now()}`,
          firstName: 'MSR',
          lastName: 'TestEmployee',
          status: 'ACTIVE',
          email: user.email,
          phone: '555-0100',
          hireDate: new Date(),
        },
      });

      employeeId = createdEmployee.id;
    } else {
      employeeId = employee.id;
    }
  });

  afterAll(async () => {
    // Cleanup: Remove test MSR card if created
    if (cardId) {
      await prisma.client.msrCard.deleteMany({
        where: { id: cardId },
      });
    }

    await app.close();
  });

  describe('POST /auth/msr/assign', () => {
    it('should assign MSR card to employee', async () => {
      const trackData = `CLOUDBADGE:TEST${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/auth/msr/assign')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          employeeId,
          badgeId: trackData,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('cardToken');
      expect(response.body.employeeId).toBe(employeeId);
      expect(response.body.status).toBe('ACTIVE');

      cardId = response.body.id;
    });

    it('should reject duplicate card assignment to same employee', async () => {
      const trackData = `CLOUDBADGE:DUPE${Date.now()}`;

      await request(app.getHttpServer())
        .post('/auth/msr/assign')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          employeeId,
          badgeId: trackData,
        })
        .expect(409); // Conflict - employee already has card
    });

    it('should reject unauthorized access (no token)', async () => {
      const trackData = `CLOUDBADGE:NOAUTH${Date.now()}`;

      await request(app.getHttpServer())
        .post('/auth/msr/assign')
        .send({
          employeeId,
          badgeId: trackData,
        })
        .expect(401); // Unauthorized
    });
  });

  describe('POST /auth/msr-swipe', () => {
    it('should authenticate with valid MSR card', async () => {
      // Get the card we assigned
      const card = await prisma.client.msrCard.findUnique({
        where: { id: cardId },
        include: { employee: true },
      });

      expect(card).toBeDefined();

      // We need to use the same track data that was hashed
      // In practice, this would be the raw badge swipe data
      // For testing, we'll create a new card with known track data
      const testTrackData = `CLOUDBADGE:SWIPETEST${Date.now()}`;
      const testCardToken = createHash('sha256')
        .update(testTrackData)
        .digest('hex');

      // Create test employee for swipe test
      const testUser = await prisma.client.user.create({
        data: {
          email: `swipe-test-${Date.now()}@demo.local`,
          password: 'hashed',
          firstName: 'Swipe',
          lastName: 'Test',
          roleLevel: 'L2',
          orgId,
          branchId,
          isActive: true,
        },
      });

      const testEmployee = await prisma.client.employee.create({
        data: {
          orgId,
          branchId,
          userId: testUser.id,
          employeeCode: `SWIPE${Date.now()}`,
          firstName: 'Swipe',
          lastName: 'Test',
          status: 'ACTIVE',
          email: testUser.email,
          phone: '555-0101',
          hireDate: new Date(),
        },
      });

      // Create MSR card with known track data
      await prisma.client.msrCard.create({
        data: {
          orgId,
          employeeId: testEmployee.id,
          cardToken: testCardToken,
          status: 'ACTIVE',
          assignedById: testUser.id,
        },
      });

      // Now test the swipe
      const response = await request(app.getHttpServer())
        .post('/auth/msr-swipe')
        .send({
          badgeId: testTrackData,
          branchId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        firstName: 'Swipe',
        lastName: 'Test',
      });

      // Cleanup
      await prisma.client.msrCard.deleteMany({
        where: { employeeId: testEmployee.id },
      });
      await prisma.client.employee.delete({
        where: { id: testEmployee.id },
      });
      await prisma.client.user.delete({
        where: { id: testUser.id },
      });
    });

    it('should reject invalid badge ID', async () => {
      await request(app.getHttpServer())
        .post('/auth/msr-swipe')
        .send({
          badgeId: 'INVALID:BADGE:DATA',
          branchId,
        })
        .expect(404); // Card not found
    });
  });

  describe('GET /auth/msr/cards', () => {
    it('should list MSR cards for organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/msr/cards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      const assignedCard = response.body.find((c: any) => c.id === cardId);
      expect(assignedCard).toBeDefined();
      expect(assignedCard.status).toBe('ACTIVE');
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .get('/auth/msr/cards')
        .expect(401); // No token
    });
  });

  describe('POST /auth/msr/revoke', () => {
    it('should revoke MSR card', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/msr/revoke')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          cardId,
          reason: 'E2E test cleanup',
        })
        .expect(200);

      expect(response.body.status).toBe('REVOKED');
      expect(response.body.revokedReason).toBe('E2E test cleanup');

      // Verify card is revoked in database
      const revokedCard = await prisma.client.msrCard.findUnique({
        where: { id: cardId },
      });

      expect(revokedCard?.status).toBe('REVOKED');
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .post('/auth/msr/revoke')
        .send({
          cardId: 'some-card-id',
          reason: 'Test',
        })
        .expect(401);
    });
  });
});
