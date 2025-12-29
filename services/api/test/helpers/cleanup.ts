import type { INestApplication } from '@nestjs/common';

/**
 * Universal E2E Test Cleanup
 * 
 * Ensures proper shutdown of NestJS app and all connections.
 * CRITICAL: Must call enableShutdownHooks() for onModuleDestroy to fire!
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
    // CRITICAL: Enable shutdown hooks to trigger onModuleDestroy lifecycle
    app.enableShutdownHooks();
    
    // Close the application (triggers onModuleDestroy lifecycle hooks)
    await app.close();
  } catch (error) {
    console.error('⚠️  Error during test cleanup:', error);
    // Don't throw - allow tests to complete
  }
}
