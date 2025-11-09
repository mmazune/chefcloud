/**
 * CacheService Metrics Emission Test
 * Verifies that Prometheus metrics are correctly emitted on cache operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { MetricsService } from '../observability/metrics.service';
import { RedisService } from './redis.service';
import { Logger } from '@nestjs/common';

describe('CacheService Metrics', () => {
  let cacheService: CacheService;
  let metricsService: MetricsService;
  let redisService: RedisService;

  // Mock metric objects
  const mockCacheHits = { inc: jest.fn() };
  const mockCacheMisses = { inc: jest.fn() };
  const mockDbQueryMs = { observe: jest.fn() };
  const mockInvalidations = { inc: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: MetricsService,
          useValue: {
            enabled: true,
            cacheHits: mockCacheHits,
            cacheMisses: mockCacheMisses,
            dbQueryMs: mockDbQueryMs,
            invalidations: mockInvalidations,
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            sMembers: jest.fn(),
          },
        },
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    metricsService = module.get<MetricsService>(MetricsService);
    redisService = module.get<RedisService>(RedisService);

    // Silence logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('readThroughWithFlag - Cache Hit', () => {
    it('should emit cache hit metric with endpoint label', async () => {
      const cachedData = { value: 'test', timestamp: Date.now() };
      jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(cachedData));

      const fetcher = jest.fn().mockResolvedValue({ data: 'fresh' });
      
      await cacheService.readThroughWithFlag(
        'test:key',
        60,
        fetcher,
        undefined,
        'franchise_overview',
      );

      expect(mockCacheHits.inc).toHaveBeenCalledWith({ endpoint: 'franchise_overview' });
      expect(mockCacheMisses.inc).not.toHaveBeenCalled();
      expect(mockDbQueryMs.observe).toHaveBeenCalledWith(
        { endpoint: 'franchise_overview', cached: 'true' },
        expect.any(Number),
      );
    });

    it('should not call fetcher on cache hit', async () => {
      const cachedData = { value: 'cached', timestamp: Date.now() };
      jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(cachedData));

      const fetcher = jest.fn().mockResolvedValue({ data: 'fresh' });
      
      const result = await cacheService.readThroughWithFlag(
        'test:key',
        60,
        fetcher,
        undefined,
        'test_endpoint',
      );

      expect(result.data).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('readThroughWithFlag - Cache Miss', () => {
    it('should emit cache miss metric with endpoint label', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const fetcher = jest.fn().mockResolvedValue({ data: 'fresh' });
      
      await cacheService.readThroughWithFlag(
        'test:key',
        60,
        fetcher,
        undefined,
        'franchise_rankings',
      );

      expect(mockCacheMisses.inc).toHaveBeenCalledWith({ endpoint: 'franchise_rankings' });
      expect(mockCacheHits.inc).not.toHaveBeenCalled();
      expect(mockDbQueryMs.observe).toHaveBeenCalledWith(
        { endpoint: 'franchise_rankings', cached: 'false' },
        expect.any(Number),
      );
    });

    it('should call fetcher and cache result on miss', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const freshData = { data: 'fresh' };
      const fetcher = jest.fn().mockResolvedValue(freshData);
      
      const result = await cacheService.readThroughWithFlag(
        'test:key',
        60,
        fetcher,
        undefined,
        'test_endpoint',
      );

      expect(fetcher).toHaveBeenCalled();
      expect(result.data).toEqual(freshData);
      expect(result.cached).toBe(false);
    });
  });

  describe('readThroughWithFlag - No Endpoint Label', () => {
    it('should use "unknown" when endpoint label not provided', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const fetcher = jest.fn().mockResolvedValue({ data: 'test' });
      
      await cacheService.readThroughWithFlag('test:key', 60, fetcher);

      expect(mockCacheMisses.inc).toHaveBeenCalledWith({ endpoint: 'unknown' });
      expect(mockDbQueryMs.observe).toHaveBeenCalledWith(
        { endpoint: 'unknown', cached: 'false' },
        expect.any(Number),
      );
    });
  });

  describe('bustPrefix - Cache Invalidation', () => {
    it('should emit invalidation metric when keys are deleted', async () => {
      const mockKeys = ['prefix:key1', 'prefix:key2', 'prefix:key3'];
      jest.spyOn(redisService, 'sMembers').mockResolvedValue(mockKeys);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const count = await cacheService.bustPrefix('overview', 'org123');

      expect(count).toBe(3);
      expect(mockInvalidations.inc).toHaveBeenCalledWith({ prefix: 'overview' });
    });

    it('should NOT emit invalidation metric when no keys deleted', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue([]);

      const count = await cacheService.bustPrefix('nonexistent', 'org456');

      expect(count).toBe(0);
      expect(mockInvalidations.inc).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Disabled', () => {
    it('should not emit metrics when metrics service disabled', async () => {
      // Override metrics service to disabled state
      (metricsService as any).enabled = false;

      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const fetcher = jest.fn().mockResolvedValue({ data: 'test' });
      
      await cacheService.readThroughWithFlag(
        'test:key',
        60,
        fetcher,
        undefined,
        'test_endpoint',
      );

      expect(mockCacheHits.inc).not.toHaveBeenCalled();
      expect(mockCacheMisses.inc).not.toHaveBeenCalled();
      expect(mockDbQueryMs.observe).not.toHaveBeenCalled();
    });
  });
});
