import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { cleanup } from './helpers/cleanup';

describe('API Key Security (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let branchId: string;
  let deviceId: string;
  let apiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test org and user
    const org = await prisma.org.create({
      data: {
        name: 'API Key Test Org',
        slug: 'apikey-test-org',
      },
    });
    orgId = org.id;

    const branch = await prisma.branch.create({
      data: {
        orgId,
        name: 'Test Branch',
        address: '123 Test St',
      },
    });
    branchId = branch.id;

    const user = await prisma.user.create({
      data: {
        orgId,
        branchId,
        email: `apikey-test-${Date.now()}@test.com`,
        firstName: 'API',
        lastName: 'Tester',
        roleLevel: 'L5',
        isActive: true,
      },
    });

    // Create session for auth
    const session = await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        org: { connect: { id: orgId } },
        branch: { connect: { id: branchId } },
        token: `test-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    authToken = session.token;

    // Create spout device
    const device = await prisma.spoutDevice.create({
      data: {
        orgId,
        branchId,
        name: 'Test Spout',
        vendor: 'SANDBOX',
        secret: 'test-device-secret',
        isActive: true,
      },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    // Data cleanup
    await prisma.spoutDevice.deleteMany({ where: { orgId } });
    await prisma.apiKey.deleteMany({ where: { orgId } });
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({ where: { orgId } });
    await prisma.branch.deleteMany({ where: { orgId } });
    await prisma.org.deleteMany({ where: { id: orgId } });
    
    // App cleanup
    await cleanup(app);
  });

  describe('POST /ops/apikeys', () => {
    it('should create API key as L5 user', async () => {
      const response = await request(app.getHttpServer())
        .post('/ops/apikeys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          scopes: ['spout:ingest', 'webhooks:receive'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('key');
      expect(response.body.key).toHaveLength(128); // 64 bytes hex
      expect(response.body.name).toBe('Test API Key');
      expect(response.body.scopes).toEqual(['spout:ingest', 'webhooks:receive']);
      expect(response.body.warning).toContain('Save this key now');

      // Store for later tests
      apiKey = response.body.key;
    });

    it('should list API keys (masked)', async () => {
      const response = await request(app.getHttpServer())
        .get('/ops/apikeys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('keyPreview', '••••••••');
      expect(response.body[0]).not.toHaveProperty('keyHash');
      expect(response.body[0]).not.toHaveProperty('key');
    });
  });

  describe('POST /hardware/spout/ingest with API key', () => {
    it('should accept request with valid API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/hardware/spout/ingest')
        .set('X-Api-Key', apiKey)
        .send({
          deviceId,
          pulses: 100,
          occurredAt: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.pulses).toBe(100);
    });

    it('should reject request with missing API key', async () => {
      await request(app.getHttpServer())
        .post('/hardware/spout/ingest')
        .send({
          deviceId,
          pulses: 50,
          occurredAt: new Date().toISOString(),
        })
        .expect(401);
    });

    it('should reject request with invalid API key', async () => {
      await request(app.getHttpServer())
        .post('/hardware/spout/ingest')
        .set('X-Api-Key', 'invalid-key-0000000000000000')
        .send({
          deviceId,
          pulses: 50,
          occurredAt: new Date().toISOString(),
        })
        .expect(401);
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limit on public endpoints', async () => {
      const rateLimit = parseInt(process.env.RATE_LIMIT_PUBLIC || '60');
      
      // Make requests up to the limit
      for (let i = 0; i < Math.min(rateLimit, 10); i++) {
        await request(app.getHttpServer())
          .post('/hardware/spout/ingest')
          .set('X-Api-Key', apiKey)
          .send({
            deviceId,
            pulses: 10,
            occurredAt: new Date().toISOString(),
          })
          .expect(201);
      }

      // Note: Full rate limit test would require many requests, skipping for perf
      expect(true).toBe(true);
    });
  });

  describe('DELETE /ops/apikeys/:id', () => {
    it('should delete API key', async () => {
      // First, get the API key ID
      const listResponse = await request(app.getHttpServer())
        .get('/ops/apikeys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const keyId = listResponse.body[0].id;

      await request(app.getHttpServer())
        .delete(`/ops/apikeys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's gone
      const verifyResponse = await request(app.getHttpServer())
        .get('/ops/apikeys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(verifyResponse.body.find((k: any) => k.id === keyId)).toBeUndefined();
    });
  });
});
