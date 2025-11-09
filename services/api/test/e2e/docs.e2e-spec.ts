import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import { setupSwagger } from '../../src/docs/swagger';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

// Minimal test module to avoid full app bootstrap
@ApiTags('Test')
@Controller('test')
class TestController {
  @ApiOperation({ summary: 'Test endpoint' })
  @Get()
  test() {
    return { ok: true };
  }
}

describe('Docs (env-gated)', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it(
    'returns 404 when DOCS_ENABLED!=1',
    async () => {
      process.env.DOCS_ENABLED = '0';
      const mod = await Test.createTestingModule({
        controllers: [TestController],
      }).compile();
      app = mod.createNestApplication();
      setupSwagger(app);
      await app.init();

      const s1 = await request(app.getHttpServer()).get('/openapi.json');
      const s2 = await request(app.getHttpServer()).get('/docs');

      expect(s1.status).toBe(404);
      expect(s2.status).toBe(404);
    },
    10000,
  ); // 10 second timeout

  it(
    'serves OpenAPI JSON when DOCS_ENABLED=1',
    async () => {
      process.env.DOCS_ENABLED = '1';
      const mod = await Test.createTestingModule({
        controllers: [TestController],
      }).compile();
      app = mod.createNestApplication();
      setupSwagger(app);
      await app.init();

      const r = await request(app.getHttpServer()).get('/openapi.json');
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toMatch(/application\/json/i);

      // Basic shape checks
      expect(r.body.openapi).toBeDefined();
      expect(r.body.openapi).toMatch(/^3\./); // OpenAPI 3.x

      // Security scheme
      const sec = r.body.components?.securitySchemes?.bearer;
      expect(sec?.type).toBe('http');
      expect(sec?.scheme).toBe('bearer');

      // Test path should be present
      expect(r.body.paths?.['/test']).toBeDefined();
    },
    10000,
  ); // 10 second timeout
});
