/**
 * M30-OPS-S5: E2E Test Application Module
 *
 * Minimal module for E2E testing to avoid circular dependency issues.
 * Only imports modules actually needed by E2E test suites.
 *
 * This module deliberately avoids importing the full AppModule to prevent
 * the "Maximum call stack size exceeded" error caused by circular dependencies
 * in the production module graph (AuthModule ↔ WorkforceModule, etc.).
 */

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../src/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { PlatformAccessGuard } from '../src/auth/platform-access.guard';
import { MeModule } from '../src/me/me.module';
import { DeviceModule } from '../src/device/device.module';
import { BadgesModule } from '../src/badges/badges.module';
import { FranchiseModule } from '../src/franchise/franchise.module';
import { LoggerMiddleware } from '../src/logger.middleware';
import { RedisService } from '../src/common/redis.service';

/**
 * E2eAppModule - Minimal test module
 *
 * Imports only essential modules to reduce dependency complexity:
 * - Core infrastructure (Config, Throttler, Prisma, Redis)
 * - Auth module (required by most E2E tests)
 * - Only domain modules that don't cause circular dependencies
 *
 * Notable exclusions:
 * - WorkforceModule (circular with AuthModule)
 * - Shifts/KpisModule/InventoryModule (creates deep circular chains)
 * - Full AppModule imports list
 *
 * Individual E2E tests can override this module to add specific dependencies.
 */
@Module({
  imports: [
    // Core infrastructure
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: parseInt(process.env.RATE_LIMIT_PUBLIC || '60'),
      },
    ]),

    // Authentication & Authorization (core for most tests)
    AuthModule,

    // Domain modules with minimal dependencies
    MeModule,
    DeviceModule,
    BadgesModule,
    FranchiseModule,
  ],
  providers: [
    PrismaService,
    RedisService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformAccessGuard,
    },
  ],
})
export class E2eAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
