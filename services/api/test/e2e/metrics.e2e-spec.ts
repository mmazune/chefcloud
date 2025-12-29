import request from 'supertest';
import { Test } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import { ObservabilityModule } from '../../src/observability/observability.module';
import { cleanup } from '../helpers/cleanup';

describe('Metrics endpoint', () => {
  let app: INestApplication;
  const prev = process.env.METRICS_ENABLED;

  beforeAll(async () => {
    process.env.METRICS_ENABLED = '1';
    const mod = await createE2ETestingModule({
      imports: [ObservabilityModule],
    });
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.METRICS_ENABLED = prev;
    await cleanup(app);
  });

  it('/metrics returns text exposition', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/(^#|\n#)/); // has comments/header
    expect(res.text).toContain('cache_hits_total');
  });
});
