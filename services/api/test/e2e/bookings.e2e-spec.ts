import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createEvent } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Bookings E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let eventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({
      imports: [AppModule],
    });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    const prisma = app.get(PrismaService);
    const factory = await createOrgWithUsers(prisma, 'e2e-bookings');
    const event = await createEvent(prisma, factory.orgId, factory.branchId);

    eventId = event.id;

    // Login as manager
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.manager.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  it('should create booking → HOLD → pay → confirm', async () => {
    // Create booking (HOLD)
    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings/reservations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        eventId,
        guestName: 'Test Guest',
        guestEmail: 'guest@test.local',
        guestPhone: '+256700000000',
        tickets: 2,
      })
      .expect(201);

    const bookingId = bookingResponse.body.id;
    expect(bookingResponse.body.status).toBe('HOLD');

    // Pay (simulate payment)
    await request(app.getHttpServer())
      .post(`/bookings/reservations/${bookingId}/pay`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        paymentMethod: 'CASH',
        amount: 100000,
      })
      .expect(201);

    // Confirm
    const confirmResponse = await request(app.getHttpServer())
      .post(`/bookings/reservations/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(confirmResponse.body.status).toBe('CONFIRMED');
  });
});
