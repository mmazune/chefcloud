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

  // Security: CORS with allowlist
  const corsAllowlist = process.env.CORS_ALLOWLIST
    ? process.env.CORS_ALLOWLIST.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: corsAllowlist,
    credentials: true,
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
  logger.info(`CORS allowlist: ${corsAllowlist.join(', ')}`);
  console.log(`[BOOTSTRAP] Server started successfully`);
}

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP] Fatal startup error:', err);
  if (err?.stack) console.error('[BOOTSTRAP] Stack:', err.stack);
  process.exit(1);
});
