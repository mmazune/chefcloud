import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const enabled = process.env.DOCS_ENABLED === '1';
  if (!enabled) {
    // noop; routes not mounted in prod unless env enabled
    return;
  }

  // Read version from package.json or env
  const version =
    process.env.BUILD_VERSION ||
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../package.json').version ||
    '0.0.0';

  const builder = new DocumentBuilder()
    .setTitle('ChefCloud API')
    .setDescription('Official API specification for ChefCloud')
    .setVersion(version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addServer(process.env.BASE_URL || 'http://localhost:3001')
    .build();

  const document = SwaggerModule.createDocument(app, builder, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('/docs', app, document, {
    jsonDocumentUrl: '/openapi.json',
    customSiteTitle: 'ChefCloud API Docs',
  });

  // Also expose the JSON explicitly at the same route (SwaggerModule.setup already does, but ensure export job stability)
  app.getHttpAdapter().get('/openapi.json', (_req, res) => {
    res.type('application/json').send(document);
  });
}
