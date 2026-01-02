import type { INestApplication } from '@nestjs/common';

/**
 * Universal E2E Test Cleanup
 *
 * Ensures proper shutdown of NestJS app and all connections.
 *
 * IMPORTANT: This assumes app.enableShutdownHooks() was called BEFORE app.init().
 * Use the createE2EApp() helper from e2e-bootstrap.ts to ensure proper setup.
 *
 * Usage in tests:
 *   import { cleanup } from '../helpers/cleanup';
 *
 *   let app: INestApplication;
 *
 *   afterAll(async () => {
 *     await cleanup(app);
 *   });
 */

export async function cleanup(app: INestApplication | null | undefined): Promise<void> {
  if (!app) {
    return; // Defensive: no-op if app not initialized
  }

  try {
    // Close the application (triggers onModuleDestroy lifecycle hooks)
    // This works properly only if enableShutdownHooks() was called before init
    await app.close();
  } catch (error) {
    console.error('⚠️  Error during test cleanup:', error);
    // Don't throw - allow tests to complete
  }
}
