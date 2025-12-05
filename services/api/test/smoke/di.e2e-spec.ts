import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CacheInvalidationService } from '../../src/common/cache-invalidation.service';
import { MetricsService } from '../../src/observability/metrics.service';
import { ReadinessService } from '../../src/observability/readiness.service';
import { CacheService } from '../../src/common/cache.service';
import { RedisService } from '../../src/common/redis.service';

/**
 * DI Graph Smoke Test
 * Ensures all cross-module providers can be resolved
 * Catches missing module imports early
 */
describe('DI graph smoke test', () => {
  let app: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Common services', () => {
    it('should resolve CacheInvalidationService', () => {
      const service = app.get(CacheInvalidationService);
      expect(service).toBeDefined();
    });

    it('should resolve CacheService', () => {
      const service = app.get(CacheService);
      expect(service).toBeDefined();
    });

    it('should resolve RedisService', () => {
      const service = app.get(RedisService);
      expect(service).toBeDefined();
    });
  });

  describe('Observability services', () => {
    it('should resolve MetricsService', () => {
      const service = app.get(MetricsService);
      expect(service).toBeDefined();
    });

    it('should resolve ReadinessService', () => {
      const service = app.get(ReadinessService);
      expect(service).toBeDefined();
    });
  });

  it('should boot app in reasonable time', async () => {
    const start = Date.now();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const testApp = moduleRef.createNestApplication();
    await testApp.init();
    const elapsed = Date.now() - start;
    
    await testApp.close();
    
    // Should boot in under 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });
});
