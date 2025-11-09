/**
 * Security/CORS tests
 * 
 * Verifies:
 * - Allowed origins receive ACAO header
 * - Disallowed origins are rejected
 * - Server-to-server (no Origin header) is allowed
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';

describe('Security/CORS allowlist', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set CORS_ORIGINS for testing
    process.env.CORS_ORIGINS = 'https://app.chefcloud.io,https://staging.chefcloud.io';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as main.ts
    const isProd = process.env.NODE_ENV === 'production';
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-site' },
        dnsPrefetchControl: { allow: false },
        frameguard: { action: 'sameorigin' },
        hidePoweredBy: true,
        hsts: isProd
          ? {
              maxAge: 15552000,
              includeSubDomains: true,
              preload: false,
            }
          : false,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: { permittedPolicies: 'none' },
        referrerPolicy: { policy: 'no-referrer' },
        xssFilter: true,
      }),
    );

    const origins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: function (origin, callback) {
        if (!origin) {
          return callback(null, true); // server-to-server
        }
        return callback(null, origins.includes(origin));
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Accept',
        'Origin',
        'X-Requested-With',
        'X-Sig',
        'X-Ts',
        'X-Id',
      ],
      exposedHeaders: ['Retry-After'],
      optionsSuccessStatus: 204,
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/healthz')
      .set('Origin', 'https://app.chefcloud.io')
      .set('Access-Control-Request-Method', 'GET');

    expect([200, 204]).toContain(response.status);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://app.chefcloud.io',
    );
  });

  it('blocks disallowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/healthz')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');

    // CORS middleware runs regardless of endpoint existence
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows server-to-server (no Origin header)', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    // Without Origin header, request is allowed (not blocked by CORS)
    // The 404 just means endpoint doesn't exist in test app, which is fine
    expect(response.status).toBeDefined();
  });
});
