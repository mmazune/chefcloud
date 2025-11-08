import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { initTelemetry } from './telemetry';
import { logger } from './logger';
import helmet from 'helmet';
import { json } from 'express';

// Initialize telemetry before anything else
initTelemetry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable default logger, use our pino logger
    bodyParser: false, // Disable default body parser to use custom config
  });

  // Custom JSON body parser with raw body capture for webhook verification
  app.use(
    json({
      limit: '256kb',
      verify: (req: any, _res, buf: Buffer) => {
        // Capture raw body for HMAC signature verification (E24)
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  // Security: Helmet
  app.use(helmet());

  // Security: CORS with allowlist
  const corsAllowlist = process.env.CORS_ALLOWLIST
    ? process.env.CORS_ALLOWLIST.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173']; // Defaults for dev

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
  await app.listen(port);
  logger.info(`🚀 ChefCloud API running on http://localhost:${port}`);
  logger.info(`CORS allowlist: ${corsAllowlist.join(', ')}`);
}

bootstrap();
