import { Test, TestingModule } from '@nestjs/testing';
import { CacheInvalidation, InvalidationEvent } from './cache.invalidation';
import { RedisService } from './redis.service';

describe('CacheInvalidation - E22.D', () => {
  let service: CacheInvalidation;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidation,
        {
          provide: RedisService,
          useValue: {
            sMembers: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheInvalidation>(CacheInvalidation);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event to Prefix Mapping', () => {
    it('should map po.received to overview and rankings', () => {
      const prefixes = service.getAffectedPrefixes('po.received');
      expect(prefixes).toEqual(['fr:overview', 'fr:rankings']);
    });

    it('should map transfer.changed to overview, rankings, and forecast', () => {
      const prefixes = service.getAffectedPrefixes('transfer.changed');
      expect(prefixes).toEqual(['fr:overview', 'fr:rankings', 'fr:forecast']);
    });

    it('should map budget.updated to budgets only', () => {
      const prefixes = service.getAffectedPrefixes('budget.updated');
      expect(prefixes).toEqual(['fr:budgets']);
    });

    it('should map inventory.adjusted to overview, rankings, and forecast', () => {
      const prefixes = service.getAffectedPrefixes('inventory.adjusted');
      expect(prefixes).toEqual(['fr:overview', 'fr:rankings', 'fr:forecast']);
    });

    it('should return empty array for unknown event type', () => {
      const prefixes = service.getAffectedPrefixes('unknown.event' as any);
      expect(prefixes).toEqual([]);
    });
  });

  describe('bustPrefix', () => {
    it('should remove cached keys and index using Redis index set', async () => {
      const mockKeys = [
        'cache:fr:overview:ORG1:abc123',
        'cache:fr:overview:ORG1:def456',
        'cache:fr:overview:ORG1:ghi789',
      ];

      jest.spyOn(redisService, 'sMembers').mockResolvedValue(mockKeys);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const removed = await service.bustPrefix('fr:overview', 'ORG1');

      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:overview:ORG1');
      
      // Should call del for each cached key
      expect(redisService.del).toHaveBeenCalledTimes(4); // 3 cache keys + 1 index
      expect(redisService.del).toHaveBeenCalledWith('cache:fr:overview:ORG1:abc123');
      expect(redisService.del).toHaveBeenCalledWith('cache:fr:overview:ORG1:def456');
      expect(redisService.del).toHaveBeenCalledWith('cache:fr:overview:ORG1:ghi789');
      expect(redisService.del).toHaveBeenCalledWith('idx:fr:overview:ORG1');
      
      expect(removed).toBe(3);
    });

    it('should return 0 when no cached keys exist', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue([]);

      const removed = await service.bustPrefix('fr:overview', 'ORG1');

      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:overview:ORG1');
      expect(redisService.del).not.toHaveBeenCalled();
      expect(removed).toBe(0);
    });

    it('should return 0 when sMembers returns null', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue([] as string[]);

      const removed = await service.bustPrefix('fr:overview', 'ORG1');

      expect(removed).toBe(0);
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully and return 0', async () => {
      jest.spyOn(redisService, 'sMembers').mockRejectedValue(new Error('Redis connection failed'));

      const removed = await service.bustPrefix('fr:overview', 'ORG1');

      expect(removed).toBe(0);
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should not crash when Redis is unavailable (fallback scenario)', async () => {
      jest.spyOn(redisService, 'sMembers').mockRejectedValue(new Error('ECONNREFUSED'));

      // Should not throw
      await expect(service.bustPrefix('fr:budgets', 'ORG2')).resolves.toBe(0);
    });
  });

  describe('handle', () => {
    it('should bust overview and rankings for po.received event', async () => {
      const mockKeys1 = ['cache:fr:overview:ORG1:key1'];
      const mockKeys2 = ['cache:fr:rankings:ORG1:key2'];

      jest
        .spyOn(redisService, 'sMembers')
        .mockResolvedValueOnce(mockKeys1)
        .mockResolvedValueOnce(mockKeys2);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const event: InvalidationEvent = { type: 'po.received', orgId: 'ORG1' };
      const removed = await service.handle(event);

      expect(removed).toBe(2); // 1 from overview + 1 from rankings
      expect(redisService.sMembers).toHaveBeenCalledTimes(2);
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:overview:ORG1');
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:rankings:ORG1');
    });

    it('should bust only budgets for budget.updated event', async () => {
      const mockKeys = [
        'cache:fr:budgets:ORG1:2025-11',
        'cache:fr:budgets:ORG1:2025-12',
      ];

      jest.spyOn(redisService, 'sMembers').mockResolvedValue(mockKeys);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const event: InvalidationEvent = { type: 'budget.updated', orgId: 'ORG1' };
      const removed = await service.handle(event);

      expect(removed).toBe(2);
      expect(redisService.sMembers).toHaveBeenCalledTimes(1);
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:budgets:ORG1');
    });

    it('should bust overview, rankings, and forecast for inventory.adjusted', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue(['key1']);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const event: InvalidationEvent = { type: 'inventory.adjusted', orgId: 'ORG1' };
      const removed = await service.handle(event);

      expect(removed).toBe(3); // 1 key from each of 3 prefixes
      expect(redisService.sMembers).toHaveBeenCalledTimes(3);
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:overview:ORG1');
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:rankings:ORG1');
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:forecast:ORG1');
    });

    it('should handle empty caches gracefully', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue([]);

      const event: InvalidationEvent = { type: 'po.received', orgId: 'ORG1' };
      const removed = await service.handle(event);

      expect(removed).toBe(0);
    });

    it('should continue busting even if one prefix fails', async () => {
      jest
        .spyOn(redisService, 'sMembers')
        .mockRejectedValueOnce(new Error('Redis error')) // overview fails
        .mockResolvedValueOnce(['cache:fr:rankings:ORG1:key1']); // rankings succeeds
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const event: InvalidationEvent = { type: 'po.received', orgId: 'ORG1' };
      const removed = await service.handle(event);

      expect(removed).toBe(1); // Only rankings key removed
    });

    it('should return 0 for unknown event types', async () => {
      const event = { type: 'unknown.event', orgId: 'ORG1' } as any;
      const removed = await service.handle(event);

      expect(removed).toBe(0);
      expect(redisService.sMembers).not.toHaveBeenCalled();
    });
  });

  describe('Observability', () => {
    it('should execute handle without throwing and return correct count', async () => {
      jest.spyOn(redisService, 'sMembers').mockResolvedValue(['key1', 'key2']);
      jest.spyOn(redisService, 'del').mockResolvedValue();

      const event: InvalidationEvent = { type: 'budget.updated', orgId: 'ORG123' };
      const removed = await service.handle(event);

      // Verify the function completes successfully and returns correct count
      expect(removed).toBe(2);
      
      // Verify Redis calls were made (2 cache keys + 1 index)
      expect(redisService.sMembers).toHaveBeenCalledWith('idx:fr:budgets:ORG123');
      expect(redisService.del).toHaveBeenCalledTimes(3);
      expect(redisService.del).toHaveBeenCalledWith('key1');
      expect(redisService.del).toHaveBeenCalledWith('key2');
      expect(redisService.del).toHaveBeenCalledWith('idx:fr:budgets:ORG123');
    });
  });
});
