import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';

/**
 * TRUE MINIMAL HARNESS - No AppModule
 * 
 * Purpose: Isolate whether hang is AppModule-related or Jest/runner-related
 * 
 * This test:
 * - Does NOT import AppModule
 * - Does NOT touch Prisma/Redis/BullMQ/Cache/SSE
 * - Creates only a trivial controller
 * - Runs exactly 1 simple test
 * 
 * If this hangs: Issue is Jest/runner/environment
 * If this does NOT hang: Issue is in AppModule dependencies
 */

@Controller('harness')
class HarnessController {
  @Get('ping')
  ping() {
    return { pong: true };
  }
}

describe('Minimal Harness (No AppModule)', () => {
  let app: INestApplication;

  it('should boot trivial module without hang', async () => {
    console.log('[HARNESS] Starting minimal module compilation...');
    const startTime = Date.now();
    
    const moduleRef = await Test.createTestingModule({
      controllers: [HarnessController],
    }).compile();
    
    console.log(`[HARNESS] Module compiled in ${Date.now() - startTime}ms`);
    
    app = moduleRef.createNestApplication();
    await app.init();
    
    console.log(`[HARNESS] App initialized in ${Date.now() - startTime}ms total`);
    
    expect(app).toBeDefined();
    
    await app.close();
    console.log(`[HARNESS] App closed successfully`);
  }, 10000);
});
