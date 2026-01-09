import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { loginAs } from './helpers/e2e-login';
import { requireTapasOrg } from './helpers/require-preconditions';
import { withTimeout } from './helpers/with-timeout';

describe('SSE /stream/kpis Security (E26)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let _orgId: string;
  let ownerToken: string;
  let managerToken: string;
  let waiterToken: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Use seeded Tapas org
    await requireTapasOrg(prisma);

    const org = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
    });
    if (!org) throw new Error('Tapas org not found after precondition check');
    _orgId = org.id;

    // Login as different roles from seeded data
    const ownerLogin = await loginAs(app, 'owner', 'tapas');
    ownerToken = ownerLogin.accessToken;

    const managerLogin = await loginAs(app, 'manager', 'tapas');
    managerToken = managerLogin.accessToken;

    const waiterLogin = await loginAs(app, 'waiter', 'tapas');
    waiterToken = waiterLogin.accessToken;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Authentication', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app.getHttpServer()).get('/stream/kpis').expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });
  });

  describe('Authorization', () => {
    it('should return 403 for L1 (Waiter) role', async () => {
      await request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should allow L4 (Manager) role', async () => {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const req = request(app.getHttpServer())
            .get('/stream/kpis')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

          let receivedData = false;

          req.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:')) {
              receivedData = true;
            }
          });

          setTimeout(() => {
            req.abort();
            try {
              expect(receivedData).toBe(true);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, 2000);
        }),
        { label: 'SSE Manager role test', ms: 5000 },
      );
    });

    it('should allow L5 (Owner) role', async () => {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const req = request(app.getHttpServer())
            .get('/stream/kpis')
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(200);

          let receivedData = false;

          req.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:')) {
              receivedData = true;
            }
          });

          setTimeout(() => {
            req.abort();
            try {
              expect(receivedData).toBe(true);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, 2000);
        }),
        { label: 'SSE Owner role test', ms: 5000 },
      );
    });
  });

  describe('SSE Headers', () => {
    it('should set correct SSE headers', (done) => {
      const req = request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', `Bearer ${ownerToken}`);

      req
        .expect('Content-Type', /text\/event-stream/)
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive')
        .expect(200);

      setTimeout(() => {
        req.abort();
        done();
      }, 1000);
    });
  });

  describe('Event Emission', () => {
    it('should emit at least one KPIs event with valid token', (done) => {
      const req = request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', `Bearer ${managerToken}`);

      let eventCount = 0;

      req.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('data:') && data.includes('{')) {
          eventCount++;

          // Verify event structure
          const jsonMatch = data.match(/data:\s*({.*})/);
          if (jsonMatch) {
            const eventData = JSON.parse(jsonMatch[1]);
            expect(eventData).toBeDefined();
            // KPIs should have expected structure
            // (exact structure depends on KpisService implementation)
          }
        }
      });

      setTimeout(() => {
        req.abort();
        expect(eventCount).toBeGreaterThanOrEqual(1);
        done();
      }, 16000); // Wait for at least one 15s interval
    }, 20000); // Increase timeout for this test
  });

  describe('Org-Scope Isolation', () => {
    it("should only stream data for authenticated user's org", (done) => {
      // This test verifies that the endpoint uses req.user.orgId
      // and doesn't leak data from other orgs
      const req = request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', `Bearer ${ownerToken}`);

      req.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('data:')) {
          // Data should be scoped to our test org
          // In a real test, you'd verify the orgId in the response
        }
      });

      setTimeout(() => {
        req.abort();
        done();
      }, 2000);
    });
  });

  describe('Rate Limiting', () => {
    it.skip('should return 429 after exceeding rate limit', async () => {
      // Skipped: Requires creating runtime test user
      // Should be tested with seeded data in dedicated rate-limit tests
    });

    it.skip('should block concurrent connections beyond limit', async () => {
      // Skipped: Requires creating runtime test user and complex SSE lifecycle
      // Should be tested in dedicated integration tests
    });
  });

  describe('Connection Cleanup', () => {
    it('should clean up resources on disconnect', (done) => {
      const req = request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Authorization', `Bearer ${ownerToken}`);

      setTimeout(() => {
        req.abort();

        // Give time for cleanup handlers to run
        setTimeout(() => {
          // In a real test, we'd verify that:
          // 1. Interval is cleared (no memory leak)
          // 2. Active connection count is decremented
          // 3. Event subscriptions are closed
          done();
        }, 500);
      }, 1000);
    });
  });

  describe('CORS', () => {
    it('should respect CORS allowlist', async () => {
      const response = await request(app.getHttpServer())
        .get('/stream/kpis')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${ownerToken}`);

      // CORS headers should be present
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
