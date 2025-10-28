import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { initTelemetry } from './telemetry';
import { logger } from './logger';
import helmet from 'helmet';

// Initialize telemetry before anything else
initTelemetry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable default logger, use our pino logger
  });

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

  // Security: Body size limit (256kb JSON)
  app.use((req: any, res: any, next: any) => {
    if (req.headers['content-type']?.includes('application/json')) {
      const limit = 256 * 1024; // 256kb
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          res.status(413).json({ error: 'Payload too large' });
          req.connection.destroy();
        }
      });
    }
    next();
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
