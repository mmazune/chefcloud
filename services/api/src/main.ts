import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { initTelemetry } from './telemetry';
import { logger } from './logger';

// Initialize telemetry before anything else
initTelemetry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable default logger, use our pino logger
  });

  app.enableCors();
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
}

bootstrap();

