import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, createEvent, disconnect } from './factory';

describe('Bookings E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let eventId: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-bookings');
    const event = await createEvent(factory.orgId, factory.branchId);

    eventId = event.id;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    // Login as manager
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.manager.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
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
