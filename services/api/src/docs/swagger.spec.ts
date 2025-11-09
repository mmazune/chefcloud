import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import { setupSwagger } from './swagger';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import request from 'supertest';

@ApiTags('Test')
@Controller('test')
class TestController {
  @ApiOperation({ summary: 'Test endpoint' })
  @Get()
  test() {
    return { ok: true };
  }
}

describe('Swagger Setup', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it(
    'does not mount docs when DOCS_ENABLED!=1',
    async () => {
      process.env.DOCS_ENABLED = '0';
      const mod = await Test.createTestingModule({
        controllers: [TestController],
      }).compile();
      app = mod.createNestApplication();
      setupSwagger(app);
      await app.init();

      const r = await request(app.getHttpServer()).get('/openapi.json');
      expect(r.status).toBe(404);
    },
    10000,
  );

  it(
    'mounts OpenAPI spec when DOCS_ENABLED=1',
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

      // OpenAPI 3.x
      expect(r.body.openapi).toBeDefined();
      expect(r.body.openapi).toMatch(/^3\./);

      // Has bearer auth
      const sec = r.body.components?.securitySchemes?.bearer;
      expect(sec?.type).toBe('http');
      expect(sec?.scheme).toBe('bearer');

      // Has test controller
      expect(r.body.paths?.['/test']).toBeDefined();
    },
    10000,
  );
});
