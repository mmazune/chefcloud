/**
 * M2-SHIFTS: E2E tests for shift templates, schedules, assignments, and manager override
 */

import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('M2 - Shifts, Scheduling & Stock-Count Gate (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let managerToken: string;
  let orgId: string;
  let branchId: string;
  let userId: string;
  let managerId: string;
  let templateId: string;
  let scheduleId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test org, branch, and users
    const org = await prisma.client.org.create({
      data: { name: 'M2 Test Org', currencyCode: 'UGX' },
    });
    orgId = org.id;

    const branch = await prisma.client.branch.create({
      data: { orgId, name: 'M2 Test Branch', address: '123 Test St', phone: '+256700000000' },
    });
    branchId = branch.id;

    // Create L4 manager user
    const manager = await prisma.client.user.create({
      data: {
        orgId,
        branchId,
        email: `m2-manager-${Date.now()}@example.com`,
        passwordHash: '$2b$10$dummyhash',
        firstName: 'Manager',
        lastName: 'User',
        roleLevel: 'L4',
      },
    });
    managerId = manager.id;

    // Create L3 staff user
    const user = await prisma.client.user.create({
      data: {
        orgId,
        branchId,
        email: `m2-staff-${Date.now()}@example.com`,
        passwordHash: '$2b$10$dummyhash',
        firstName: 'Staff',
        lastName: 'User',
        roleLevel: 'L3',
      },
    });
    userId = user.id;

    // Create tokens
    const managerSession = await prisma.client.session.create({
      data: {
        userId: managerId,
        token: `m2-manager-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    managerToken = managerSession.token;

    const userSession = await prisma.client.session.create({
      data: {
        userId,
        token: `m2-staff-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    authToken = userSession.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.client.org.delete({ where: { id: orgId } });
    await app.close();
  });

  describe('Shift Templates', () => {
    it('POST /shift-templates - creates a lunch shift template', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Lunch Shift',
          startTime: '11:00',
          endTime: '16:00',
          description: 'Standard lunch service',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Lunch Shift',
        startTime: '11:00',
        endTime: '16:00',
        isActive: true,
      });
      templateId = res.body.id;
    });

    it('POST /shift-templates - creates a dinner shift template', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Dinner Shift',
          startTime: '17:00',
          endTime: '23:00',
          description: 'Evening dinner service',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Dinner Shift',
        startTime: '17:00',
        endTime: '23:00',
      });
    });

    it('POST /shift-templates - rejects invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/shift-templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Invalid Shift',
          startTime: '25:00', // Invalid hour
          endTime: '16:00',
        })
        .expect(400);
    });

    it('POST /shift-templates - rejects end time before start time', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Bad Shift',
          startTime: '18:00',
          endTime: '12:00', // Before start
        })
        .expect(409);

      expect(res.body.message).toContain('endTime must be after startTime');
    });

    it('GET /shift-templates - lists all templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/shift-templates')
        .set('Authorization', `Bearer ${authToken}`) // L3 can view
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.find((t: any) => t.name === 'Lunch Shift')).toBeDefined();
    });

    it('GET /shift-templates/:id - gets template by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shift-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.name).toBe('Lunch Shift');
    });

    it('PATCH /shift-templates/:id - updates template', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/shift-templates/${templateId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ description: 'Updated lunch service' })
        .expect(200);

      expect(res.body.description).toBe('Updated lunch service');
    });

    it('DELETE /shift-templates/:id - soft deletes template', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/shift-templates/${templateId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.isActive).toBe(false);

      // Verify it's not in default list
      const list = await request(app.getHttpServer())
        .get('/shift-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(list.body.find((t: any) => t.id === templateId)).toBeUndefined();
    });
  });

  describe('Shift Schedules', () => {
    beforeAll(async () => {
      // Reactivate template for schedule tests
      await prisma.shiftTemplate.update({
        where: { id: templateId },
        data: { isActive: true },
      });
    });

    it('POST /shift-schedules - creates a schedule from template', async () => {
      const tomorrow = new Date(Date.now() + 86400000);
      const startTime = new Date(tomorrow);
      startTime.setHours(11, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setHours(16, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/shift-schedules')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branchId,
          date: tomorrow.toISOString().split('T')[0],
          templateId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
        .expect(201);

      expect(res.body).toMatchObject({
        branchId,
        templateId,
      });
      scheduleId = res.body.id;
    });

    it('POST /shift-schedules - rejects overlapping schedule', async () => {
      const tomorrow = new Date(Date.now() + 86400000);
      const startTime = new Date(tomorrow);
      startTime.setHours(12, 0, 0, 0); // Overlaps with 11:00-16:00
      const endTime = new Date(tomorrow);
      endTime.setHours(17, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/shift-schedules')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branchId,
          date: tomorrow.toISOString().split('T')[0],
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('GET /shift-schedules/by-branch/:branchId - lists schedules', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shift-schedules/by-branch/${branchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /shift-schedules/:id - gets schedule details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shift-schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(scheduleId);
      expect(res.body.template).toBeDefined();
      expect(res.body.branch).toBeDefined();
    });
  });

  describe('Shift Assignments', () => {
    it('POST /shift-assignments - assigns staff to schedule', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-assignments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          scheduleId,
          userId,
          role: 'WAITER',
          isManagerOnDuty: false,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        scheduleId,
        userId,
        role: 'WAITER',
        isManagerOnDuty: false,
      });
      expect(res.body.user).toMatchObject({
        firstName: 'Staff',
        lastName: 'User',
      });
    });

    it('POST /shift-assignments - assigns manager on duty', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-assignments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          scheduleId,
          userId: managerId,
          role: 'MANAGER',
          isManagerOnDuty: true,
        })
        .expect(201);

      expect(res.body.isManagerOnDuty).toBe(true);
    });

    it('POST /shift-assignments - rejects duplicate assignment', async () => {
      const res = await request(app.getHttpServer())
        .post('/shift-assignments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          scheduleId,
          userId,
          role: 'COOK',
        })
        .expect(409);

      expect(res.body.message).toContain('already assigned');
    });

    it('GET /shift-assignments/by-schedule/:scheduleId - lists assignments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shift-assignments/by-schedule/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      // Manager on duty should be first
      expect(res.body[0].isManagerOnDuty).toBe(true);
    });

    it('GET /shift-assignments/by-user/:userId - lists user assignments', async () => {
      const tomorrow = new Date(Date.now() + 86400000);
      const nextWeek = new Date(Date.now() + 7 * 86400000);

      const res = await request(app.getHttpServer())
        .get(`/shift-assignments/by-user/${userId}`)
        .query({
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: nextWeek.toISOString().split('T')[0],
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].schedule).toBeDefined();
    });
  });

  describe('Current Shift API', () => {
    it('GET /shift-schedules/current/:branchId - returns empty when no active shift', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shift-schedules/current/${branchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should be empty since schedule is for tomorrow
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });

    it('GET /shift-schedules/current/:branchId - returns current shift with staff', async () => {
      // Create a schedule for today
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(startTime.getHours() - 1); // Started 1 hour ago
      const endTime = new Date(now);
      endTime.setHours(endTime.getHours() + 2); // Ends in 2 hours

      const todaySchedule = await prisma.shiftSchedule.create({
        data: {
          orgId,
          branchId,
          date: new Date(now.toISOString().split('T')[0]),
          startTime,
          endTime,
        },
      });

      await prisma.shiftAssignment.create({
        data: {
          scheduleId: todaySchedule.id,
          userId,
          role: 'WAITER',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/shift-schedules/current/${branchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].assignments).toBeDefined();
      expect(res.body[0].assignments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Manager Override for Stock Count', () => {
    let shiftId: string;
    let stockCountId: string;

    beforeAll(async () => {
      // Open a shift
      const shift = await prisma.client.shift.create({
        data: {
          orgId,
          branchId,
          openedById: userId,
          openingFloat: 100.0,
        },
      });
      shiftId = shift.id;

      // Create an inventory item
      const item = await prisma.client.inventoryItem.create({
        data: {
          orgId,
          branchId,
          name: 'Test Item',
          sku: `TEST-${Date.now()}`,
          unit: 'kg',
          currentStock: 100.0,
          targetStock: 90.0,
          minStock: 80.0,
        },
      });

      // Create an out-of-tolerance stock count
      stockCountId = (
        await prisma.client.stockCount.create({
          data: {
            orgId,
            branchId,
            itemId: item.id,
            shiftId,
            countedById: userId,
            expectedQty: 100.0,
            countedQty: 50.0, // 50% variance - out of tolerance
            varianceQty: -50.0,
            variancePct: -50.0,
            notes: 'Test out-of-tolerance count',
          },
        })
      ).id;

      // Set org tolerance settings
      await prisma.client.orgSettings.upsert({
        where: { orgId },
        create: {
          orgId,
          stockCountTolerancePct: 10.0, // 10% tolerance
          stockCountToleranceAbsolute: 5.0,
        },
        update: {
          stockCountTolerancePct: 10.0,
          stockCountToleranceAbsolute: 5.0,
        },
      });
    });

    it('PATCH /shifts/:id/close - blocks close when stock count out of tolerance', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${authToken}`) // L3 staff
        .send({ declaredCash: 100.0 })
        .expect(409);

      expect(res.body.code).toBe('COUNT_OUT_OF_TOLERANCE');
      expect(res.body.details).toBeDefined();
    });

    it('PATCH /shifts/:id/close - rejects override from L3 staff', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${authToken}`) // L3 staff
        .send({
          declaredCash: 100.0,
          override: {
            reason: 'L3 attempting override',
          },
        })
        .expect(403);

      expect(res.body.message).toContain('Only managers');
    });

    it('PATCH /shifts/:id/close - allows manager override', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${managerToken}`) // L4 manager
        .send({
          declaredCash: 100.0,
          override: {
            reason: 'Physical count verified by manager after theft incident',
          },
        })
        .expect(200);

      expect(res.body.closedAt).toBeDefined();
      expect(res.body.overrideUserId).toBe(managerId);
      expect(res.body.overrideReason).toBe(
        'Physical count verified by manager after theft incident',
      );
      expect(res.body.overrideAt).toBeDefined();
      expect(res.body.overrideBy).toMatchObject({
        firstName: 'Manager',
        lastName: 'User',
      });

      // Verify override audit event was created
      const auditEvents = await prisma.client.auditEvent.findMany({
        where: {
          resourceId: shiftId,
          action: 'shift.stock_count_override',
        },
      });
      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].metadata).toMatchObject({
        reason: 'Physical count verified by manager after theft incident',
        overrideBy: managerId,
      });
    });
  });
});
