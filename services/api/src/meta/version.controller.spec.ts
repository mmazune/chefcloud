import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { VersionController } from './version.controller';

describe('/version endpoint', () => {
  let app: INestApplication;
  const prevEnv = {
    BV: process.env.BUILD_VERSION,
    BS: process.env.BUILD_SHA,
    BD: process.env.BUILD_DATE,
  };

  beforeAll(async () => {
    process.env.BUILD_VERSION = '1.2.3-test';
    process.env.BUILD_SHA = 'abc123def';
    process.env.BUILD_DATE = '2025-11-08T12:34:56Z';
    const mod = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.BUILD_VERSION = prevEnv.BV;
    process.env.BUILD_SHA = prevEnv.BS;
    process.env.BUILD_DATE = prevEnv.BD;
    if (app) await app.close();
  });

  it('returns version/build info JSON', async () => {
    const res = await request(app.getHttpServer()).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.2.3-test');
    expect(res.body.commit).toBe('abc123def');
    expect(res.body.builtAt).toBe('2025-11-08T12:34:56Z');
    expect(res.body.node).toMatch(/^v\d+\./);
    expect(res.body.env).toBeDefined();
  });
});
