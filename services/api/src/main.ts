import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { logger } from './logger';
import helmet from 'helmet';
import { json } from 'express';
import { RequestIdMiddleware } from './meta/request-id.middleware';
import { HttpLoggerMiddleware } from './logging/http-logger.middleware';
import { GlobalExceptionFilter } from './errors/global-exception.filter';

// Catch all unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('[PROCESS] Uncaught Exception:', error);
  process.exit(1);
});

async function bootstrap() {
  console.log('[BOOTSTRAP] Starting ChefCloud API', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? '***configured***' : '***MISSING***',
    JWT_SECRET: process.env.JWT_SECRET ? '***configured***' : '***MISSING***',
  });

  console.log('[BOOTSTRAP] Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'], // Enable default logger for debugging
    bodyParser: false,
  });
  console.log('[BOOTSTRAP] NestJS application created');

  // Custom JSON body parser with raw body capture for webhook verification
  app.use(
    json({
      limit: '256kb',
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  // Security: Helmet
  app.use(helmet());

  // Security: Trust proxy for Render.com (enables correct IP detection)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security: CORS with allowlist - support multiple env var names
  const rawOrigins =
    process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    process.env.cors_origin ||
    process.env.CORS_ALLOWLIST ||
    'http://localhost:3000,http://localhost:5173';

  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  console.log(
    `[BOOTSTRAP] CORS enabled for ${allowedOrigins.length} origin(s): ${allowedOrigins.join(', ')}`,
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no Origin header)
      if (!origin) {
        return callback(null, true);
      }

      // Allow if origin is in allowedOrigins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Deny - but don't crash, just log
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Idempotency-Key',
      'X-Client-Platform',
      'X-Org-Id',
      'Accept',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;

  // Meta: Request-ID middleware (after security, before routes)
  app.use(new RequestIdMiddleware().use);

  // Logging: Pino HTTP logger (after Request-ID)
  app.use(new HttpLoggerMiddleware().use);

  // Errors: Global standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  console.log(`[BOOTSTRAP] Binding to 0.0.0.0:${port}...`);
  await app.listen(port, '0.0.0.0');
  logger.info(`🚀 ChefCloud API running on http://0.0.0.0:${port}`);
  logger.info(`CORS allowlist: ${allowedOrigins.join(', ')}`);
  console.log(`[BOOTSTRAP] Server started successfully`);
}

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP] Fatal startup error:', err);
  if (err?.stack) console.error('[BOOTSTRAP] Stack:', err.stack);
  process.exit(1);
});
