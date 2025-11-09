import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

describe('CacheService - E22.A', () => {
  let service: CacheService;
  let redisService: RedisService;

  beforeEach(async () => {
    // Mock setInterval to prevent actual intervals from running
    jest.useFakeTimers();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            setEx: jest.fn(),
            del: jest.fn(),
            sAdd: jest.fn(),
            sMembers: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    // Clean up the service and restore timers
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeParams', () => {
    it('should sort keys deterministically', () => {
      const params = { b: 1, a: 2, c: 0 };
      const normalized = service.normalizeParams(params);
      const keys = Object.keys(JSON.parse(Buffer.from(normalized, 'base64url').toString()));
      
      expect(keys).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty params', () => {
      const normalized = service.normalizeParams({});
      expect(normalized).toBeDefined();
      expect(typeof normalized).toBe('string');
    });

    it('should handle arrays in params', () => {
      const params = { tags: ['z', 'a', 'b'], name: 'test' };
      const normalized = service.normalizeParams(params);
      
      expect(normalized).toBeDefined();
      const decoded = JSON.parse(Buffer.from(normalized, 'base64url').toString());
      expect(decoded.tags).toEqual(['a', 'b', 'z']); // Arrays should be sorted
    });
  });

  describe('makeKey', () => {
    it('should generate stable keys for same inputs', () => {
      const key1 = service.makeKey('fr:overview', 'ORG1', { b: 1, a: 2 });
      const key2 = service.makeKey('fr:overview', 'ORG1', { a: 2, b: 1 });
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = service.makeKey('fr:overview', 'ORG1', { period: '2025-01' });
      const key2 = service.makeKey('fr:overview', 'ORG1', { period: '2025-02' });
      
      expect(key1).not.toBe(key2);
    });

    it('should include prefix and orgId in key', () => {
      const key = service.makeKey('fr:overview', 'ORG123', { period: '2025-01' });
      
      expect(key).toContain('cache:fr:overview');
      expect(key).toContain('ORG123');
    });
  });

  describe('readThroughWithFlag', () => {
    it('should return cached=false on first call (cache miss)', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'setEx').mockResolvedValue();
      
      const fetcher = jest.fn().mockResolvedValue({ data: 'test' });
      
      const result = await service.readThroughWithFlag(
        'test:key',
        15,
        fetcher,
      );
      
      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ data: 'test' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached=true on second call (cache hit)', async () => {
      const cachedData = { data: 'cached' };
      
      // Mock Redis to return the cached value
      jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(cachedData));
      
      const fetcher = jest.fn().mockResolvedValue(cachedData);
      
      const result = await service.readThroughWithFlag(
        'test:key',
        15,
        fetcher,
      );
      
      expect(result.cached).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled(); // Should not call fetcher on cache hit
    });

    it('should store fetched data with TTL', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const setExSpy = jest.spyOn(redisService, 'setEx').mockResolvedValue();
      
      const fetcher = jest.fn().mockResolvedValue({ data: 'test' });
      
      await service.readThroughWithFlag('test:key', 30, fetcher);
      
      expect(setExSpy).toHaveBeenCalledWith(
        'test:key',
        30,
        expect.any(String),
      );
    });
  });

  describe('makeIndexKey', () => {
    it('should generate index key with prefix and orgId', () => {
      const indexKey = service.makeIndexKey('overview', 'ORG123');
      
      expect(indexKey).toBe('idx:overview:ORG123');
    });
  });

  describe('bustPrefix', () => {
    it('should delete all cached keys for a prefix', async () => {
      const keys = ['cache:fr:overview:ORG1:abc', 'cache:fr:overview:ORG1:def'];
      
      jest.spyOn(redisService, 'sMembers').mockResolvedValue(keys);
      const delSpy = jest.spyOn(redisService, 'del').mockResolvedValue();
      
      const deletedCount = await service.bustPrefix('overview', 'ORG1');
      
      expect(deletedCount).toBe(2);
      expect(delSpy).toHaveBeenCalledTimes(3); // 2 cache keys + 1 index key
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  // E22.B: Rankings-specific tests
  describe('E22.B - Rankings Cache Keys', () => {
    it('rankings makeKey should be stable regardless of param order', () => {
      const key1 = service.makeKey('fr:rankings', 'ORG1', { 
        period: '2025-11', 
        metric: 'revenue', 
        groupBy: 'branch' 
      });
      const key2 = service.makeKey('fr:rankings', 'ORG1', { 
        groupBy: 'branch', 
        period: '2025-11', 
        metric: 'revenue' 
      });
      
      expect(key1).toBe(key2);
      expect(key1).toContain('fr:rankings');
      expect(key1).toContain('ORG1');
    });

    it('readThroughWithFlag should return cached=true on second read for rankings', async () => {
      jest.spyOn(redisService, 'get')
        .mockResolvedValueOnce(null) // First call: miss
        .mockResolvedValueOnce(JSON.stringify({ rankings: [{ id: 1 }] })); // Second call: hit
      jest.spyOn(redisService, 'setEx').mockResolvedValue();
      
      let fetchCalls = 0;
      const fetcher = jest.fn().mockImplementation(async () => {
        fetchCalls++;
        return { rankings: [{ id: 1 }] };
      });
      
      const key = service.makeKey('fr:rankings', 'ORG1', { period: '2025-11' });
      
      const result1 = await service.readThroughWithFlag(key, 30, fetcher);
      const result2 = await service.readThroughWithFlag(key, 30, fetcher);
      
      expect(fetchCalls).toBe(1); // Fetcher called only once
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result2.data).toEqual({ rankings: [{ id: 1 }] });
    });
  });

  describe('E22.C - Budgets Cache Keys', () => {
    it('budgets makeKey should be stable regardless of param order', () => {
      const key1 = service.makeKey('fr:budgets', 'ORG1', { 
        period: '2025-11', 
        level: 'branch' 
      });
      const key2 = service.makeKey('fr:budgets', 'ORG1', { 
        level: 'branch', 
        period: '2025-11' 
      });
      
      expect(key1).toBe(key2);
      expect(key1).toContain('fr:budgets');
      expect(key1).toContain('ORG1');
    });

    it('readThroughWithFlag should return cached=true on second read for budgets with TTL=60', async () => {
      jest.spyOn(redisService, 'get')
        .mockResolvedValueOnce(null) // First call: miss
        .mockResolvedValueOnce(JSON.stringify({ budgets: [{ branchId: 'B1', revenue: 5000 }] })); // Second call: hit
      jest.spyOn(redisService, 'setEx').mockResolvedValue();
      
      let fetchCalls = 0;
      const fetcher = jest.fn().mockImplementation(async () => {
        fetchCalls++;
        return { budgets: [{ branchId: 'B1', revenue: 5000 }] };
      });
      
      const key = service.makeKey('fr:budgets', 'ORG1', { period: '2025-11' });
      
      const result1 = await service.readThroughWithFlag(key, 60, fetcher);
      const result2 = await service.readThroughWithFlag(key, 60, fetcher);
      
      expect(fetchCalls).toBe(1); // Fetcher called only once
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result2.data).toEqual({ budgets: [{ branchId: 'B1', revenue: 5000 }] });
    });
  });
});
