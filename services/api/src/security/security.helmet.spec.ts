/**
 * Security/Helmet headers tests
 * 
 * Verifies:
 * - Standard security headers are present
 * - X-Powered-By is hidden
 * - HSTS is production-only
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';

describe('Security/Helmet headers', () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';

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

    app.enableCors({
      origin: false,
      credentials: false,
    });

    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  it('emits basic security headers', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    expect(response.headers['x-dns-prefetch-control']).toBe('off');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBeDefined();
  });

  it('hides X-Powered-By header', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not set HSTS in development', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('Security/Helmet headers (production)', () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';

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

    app.enableCors({
      origin: false,
      credentials: false,
    });

    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  it('sets HSTS header in production', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain(
      'max-age=15552000',
    );
    expect(response.headers['strict-transport-security']).toContain(
      'includeSubDomains',
    );
  });
});
