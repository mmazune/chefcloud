import { Test, TestingModule } from '@nestjs/testing';
import { SessionInvalidationService } from './session-invalidation.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';

describe('SessionInvalidationService', () => {
  let service: SessionInvalidationService;
  let prismaService: Partial<PrismaService>;
  let redisService: Partial<RedisService>;

  beforeEach(async () => {
    // Mock Prisma
    prismaService = {
      client: {
        session: {
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
      } as any,
    };

    // Mock Redis (fail-open, no errors)
    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionInvalidationService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get<SessionInvalidationService>(SessionInvalidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidateByBadge', () => {
    it('should invalidate all sessions for a badge', async () => {
      const badgeId = 'badge-123';
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', badgeId, token: 'token-1', user: { id: 'user-1' } },
        { id: 'session-2', userId: 'user-2', badgeId, token: 'token-2', user: { id: 'user-2' } },
      ];

      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue(mockSessions);
      (prismaService.client!.user.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await service.invalidateByBadge(badgeId, 'REVOKED');

      expect(result).toBe(2);
      expect(prismaService.client!.session.findMany).toHaveBeenCalledWith({
        where: { badgeId },
        include: { user: true },
      });
      expect(prismaService.client!.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] } },
        data: { sessionVersion: { increment: 1 } },
      });
      expect(prismaService.client!.session.deleteMany).toHaveBeenCalledWith({
        where: { badgeId },
      });
    });

    it('should return 0 if no sessions found', async () => {
      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.invalidateByBadge('badge-123', 'LOST');

      expect(result).toBe(0);
      expect(prismaService.client!.user.updateMany).not.toHaveBeenCalled();
      expect(prismaService.client!.session.deleteMany).not.toHaveBeenCalled();
    });

    it('should add tokens to deny list', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', badgeId: 'badge-123', token: 'token-abc', user: { id: 'user-1' } },
      ];

      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue(mockSessions);
      (prismaService.client!.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.invalidateByBadge('badge-123', 'REVOKED');

      expect(redisService.set).toHaveBeenCalled();
      const setCall = (redisService.set as jest.Mock).mock.calls[0];
      expect(setCall[0]).toMatch(/^deny:/);
    });
  });

  describe('invalidateByUser', () => {
    it('should invalidate all sessions for a user', async () => {
      const userId = 'user-123';
      const mockSessions = [
        { id: 'session-1', userId, token: 'token-1' },
        { id: 'session-2', userId, token: 'token-2' },
      ];

      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue(mockSessions);
      (prismaService.client!.user.update as jest.Mock).mockResolvedValue({ sessionVersion: 1 });
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await service.invalidateByUser(userId);

      expect(result).toBe(2);
      expect(prismaService.client!.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      });
      expect(prismaService.client!.session.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should handle custom reason', async () => {
      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue([]);

      await service.invalidateByUser('user-123', 'manual_logout');

      // Should complete without error
      expect(prismaService.client!.session.findMany).toHaveBeenCalled();
    });
  });

  describe('isDenied', () => {
    it('should return true if JTI is in deny list', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('{"reason":"revoked"}');

      const result = await service.isDenied('jti-123');

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith('deny:jti-123');
    });

    it('should return false if JTI is not in deny list', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.isDenied('jti-456');

      expect(result).toBe(false);
    });

    it('should return false (fail-open) if Redis fails', async () => {
      (redisService.get as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const result = await service.isDenied('jti-789');

      expect(result).toBe(false);
    });
  });

  describe('getSessionVersion', () => {
    it('should return current session version for user', async () => {
      (prismaService.client!.user.findUnique as jest.Mock).mockResolvedValue({
        sessionVersion: 5,
      });

      const version = await service.getSessionVersion('user-123');

      expect(version).toBe(5);
      expect(prismaService.client!.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { sessionVersion: true },
      });
    });

    it('should return 0 if user not found', async () => {
      (prismaService.client!.user.findUnique as jest.Mock).mockResolvedValue(null);

      const version = await service.getSessionVersion('user-999');

      expect(version).toBe(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(10);
      expect(prismaService.client!.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if invalidation fails', async () => {
      (prismaService.client!.session.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.invalidateByBadge('badge-123', 'REVOKED')).rejects.toThrow(
        'Database error'
      );
    });

    it('should not fail if Redis deny list fails', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', badgeId: 'badge-123', token: 'token-1', user: { id: 'user-1' } },
      ];

      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue(mockSessions);
      (prismaService.client!.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (redisService.set as jest.Mock).mockRejectedValue(new Error('Redis down'));

      // Should complete successfully despite Redis failure
      const result = await service.invalidateByBadge('badge-123', 'LOST');
      expect(result).toBe(1);
    });
  });

  describe('event emission', () => {
    it('should emit invalidation event via Redis pub/sub', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', badgeId: 'badge-123', token: 'token-1', user: { id: 'user-1' } },
      ];

      (prismaService.client!.session.findMany as jest.Mock).mockResolvedValue(mockSessions);
      (prismaService.client!.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.client!.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.invalidateByBadge('badge-123', 'REVOKED');

      expect(redisService.publish).toHaveBeenCalledWith(
        'session:invalidation',
        expect.stringContaining('"type":"badge"')
      );
    });
  });
});
