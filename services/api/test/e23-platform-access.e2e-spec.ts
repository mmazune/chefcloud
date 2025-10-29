import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('E23 Platform Access (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public routes bypass', () => {
    it('should allow unauthenticated access to /health', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .set('X-Client-Platform', 'mobile')
        .expect(200);
    });

    it('should allow unauthenticated access to /health from any platform', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .set('X-Client-Platform', 'desktop')
        .expect(200);

      await request(app.getHttpServer())
        .get('/health')
        .set('X-Client-Platform', 'web')
        .expect(200);
    });

    it('should allow unauthenticated POST to /auth/login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Client-Platform', 'mobile')
        .send({ email: 'test@test.com', password: 'wrong' })
        .expect(401); // Auth fails, but platform guard didn't block
    });
  });

  describe('Platform header handling', () => {
    it('should work without X-Client-Platform header (defaults to web)', async () => {
      await request(app.getHttpServer())
        .get('/health')
        // No X-Client-Platform header
        .expect(200);
    });
  });
});

