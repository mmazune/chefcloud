import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, ModuleMetadata, ValidationPipe } from '@nestjs/common';
import { trace, traceSpan } from './e2e-trace';

/**
 * Create an E2E testing module with standard configuration.
 * This is a thin wrapper around Test.createTestingModule() for consistency.
 *
 * @param metadata - Module metadata (imports, providers, controllers, etc.)
 * @returns TestingModule instance
 */
export async function createE2ETestingModule(metadata: ModuleMetadata): Promise<TestingModule> {
  return traceSpan('createE2ETestingModule', async () => {
    // CRITICAL: Ensure JWT_SECRET is always present for E2E tests
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-e2e-jwt-secret-deterministic-12345';
      trace('JWT_SECRET was missing - set deterministic E2E fallback');
    }

    trace('building testing module');
    const moduleBuilder = Test.createTestingModule(metadata);
    trace('compiling module');
    const module = await moduleBuilder.compile();
    trace('module compiled');
    return module;
  });
}

/**
 * Create an E2E testing module builder for advanced configuration.
 * Use this when you need to override providers, mock dependencies, etc.
 *
 * @param metadata - Module metadata (imports, providers, controllers, etc.)
 * @returns TestingModuleBuilder instance (call .compile() to finalize)
 */
export function createE2ETestingModuleBuilder(metadata: ModuleMetadata): TestingModuleBuilder {
  return Test.createTestingModule(metadata);
}

/**
 * Create and initialize a NestJS application for E2E testing with proper lifecycle management.
 *
 * CRITICAL: This helper ensures enableShutdownHooks() is called BEFORE app.init(),
 * which is required for onModuleDestroy lifecycle hooks to fire during cleanup.
 *
 * @param metadata - Module metadata (imports, providers, controllers, etc.)
 * @param options - Optional configuration
 * @param options.enableValidation - Whether to enable global ValidationPipe (default: true)
 * @returns Initialized INestApplication ready for testing
 *
 * @example
 * ```typescript
 * let app: INestApplication;
 *
 * beforeAll(async () => {
 *   app = await createE2EApp({ imports: [AppModule] });
 * });
 *
 * afterAll(async () => {
 *   await cleanup(app);
 * });
 * ```
 */
export async function createE2EApp(
  metadata: ModuleMetadata,
  options: { enableValidation?: boolean } = {},
): Promise<INestApplication> {
  return traceSpan('createE2EApp', async () => {
    const { enableValidation = true } = options;

    // CRITICAL: Ensure JWT_SECRET is always present for E2E tests
    // This prevents cryptic "secretOrPrivateKey must have a value" errors
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-e2e-jwt-secret-deterministic-12345';
      trace('JWT_SECRET was missing - set deterministic E2E fallback');
    }

    // 1. Create testing module
    trace('creating testing module');
    const moduleRef: TestingModule = await Test.createTestingModule(metadata).compile();
    trace('testing module compiled');

    // 2. Create Nest application
    trace('creating Nest application');
    const app = moduleRef.createNestApplication();
    trace('Nest application created');

    // 3. Apply global validation pipe if requested
    if (enableValidation) {
      trace('applying global validation pipe');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
    }

    // 4. CRITICAL: Enable shutdown hooks BEFORE init
    // This ensures onModuleDestroy lifecycle hooks fire when app.close() is called
    trace('enabling shutdown hooks');
    app.enableShutdownHooks();

    // 5. Initialize the application
    trace('initializing application');
    await app.init();
    trace('application initialized');

    return app;
  });
}
