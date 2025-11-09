import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../src/prisma.service';
import request from 'supertest';

/**
 * E2E Test Harness
 *
 * Builds focused TestingModule instances (no full AppModule) with:
 * - Only the modules needed for the specific E2E test
 * - ConfigModule + JwtModule for auth
 * - PrismaService for database access
 * - Global ValidationPipe (whitelist + transform)
 *
 * Usage:
 * ```ts
 * const { app, moduleRef, prisma } = await buildTestApp([AuthModule, WorkforceModule]);
 * const token = await loginAs(app, 'user@test.local', 'Test#123');
 * ```
 */

interface TestAppContext {
  app: INestApplication;
  moduleRef: TestingModule;
  prisma: PrismaService;
}

/**
 * Build a focused E2E test application
 * @param imports Array of NestJS modules to import (e.g., [AuthModule, PosModule])
 * @returns app, moduleRef, and prisma service
 */
export async function buildTestApp(imports: Array<Type<any>>): Promise<TestAppContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      // Core modules for E2E
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.e2e',
      }),
      JwtModule.register({
        global: true,
        secret: 'test-jwt-secret-e2e-only',
        signOptions: { expiresIn: '1h' },
      }),
      // User-specified modules
      ...imports,
    ],
    providers: [PrismaService],
    exports: [PrismaService],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Global validation pipe (whitelist + transform)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);

  return { app, moduleRef: moduleFixture, prisma };
}

/**
 * Login helper for E2E tests
 * @param app NestJS application instance
 * @param email User email
 * @param password User password
 * @returns JWT access token
 */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  if (!response.body.access_token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(response.body)}`);
  }

  return response.body.access_token;
}

/**
 * Cleanup helper - close app and disconnect Prisma
 */
export async function cleanupTestApp(context: TestAppContext): Promise<void> {
  await context.app.close();
  // PrismaService.onModuleDestroy handles disconnect automatically
}
