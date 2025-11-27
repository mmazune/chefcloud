import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DevApiKeysService } from './dev-api-keys.service';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

describe('DevApiKeysService', () => {
  let service: DevApiKeysService;
  let prismaService: PrismaService;

  const mockPrisma = {
    devApiKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevApiKeysService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DevApiKeysService>(DevApiKeysService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createKey', () => {
    it('should create an API key with correct prefix for PRODUCTION', async () => {
      const dto = {
        orgId: 'org-123',
        name: 'Production Key',
        description: 'For production use',
        environment: 'PRODUCTION' as const,
      };

      const mockKey = {
        id: 'key-123',
        orgId: 'org-123',
        createdByUserId: 'user-123',
        name: 'Production Key',
        description: 'For production use',
        keyHash: 'hashed',
        prefix: 'cc_live_',
        environment: 'PRODUCTION',
        status: 'ACTIVE',
        createdAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
        usageCount: 0,
      };

      mockPrisma.devApiKey.create.mockResolvedValue(mockKey);

      const result = await service.createKey(dto, 'user-123');

      expect(result.key).toEqual(mockKey);
      expect(result.rawKey).toMatch(/^cc_live_/);
      expect(result.rawKey.length).toBeGreaterThanOrEqual(40);
      expect(result.warning).toContain('never be shown again');
      expect(mockPrisma.devApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prefix: 'cc_live_',
            environment: 'PRODUCTION',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should create an API key with correct prefix for SANDBOX', async () => {
      const dto = {
        orgId: 'org-123',
        name: 'Test Key',
        environment: 'SANDBOX' as const,
      };

      const mockKey = {
        id: 'key-456',
        orgId: 'org-123',
        createdByUserId: 'user-123',
        name: 'Test Key',
        description: null,
        keyHash: 'hashed',
        prefix: 'cc_test_',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        createdAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
        usageCount: 0,
      };

      mockPrisma.devApiKey.create.mockResolvedValue(mockKey);

      const result = await service.createKey(dto, 'user-123');

      expect(result.rawKey).toMatch(/^cc_test_/);
      expect(mockPrisma.devApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prefix: 'cc_test_',
            environment: 'SANDBOX',
          }),
        }),
      );
    });

    it('should hash the key before storing', async () => {
      const dto = {
        orgId: 'org-123',
        name: 'Test Key',
        environment: 'PRODUCTION' as const,
      };

      mockPrisma.devApiKey.create.mockResolvedValue({
        id: 'key-123',
        keyHash: 'hashed-value',
      } as any);

      await service.createKey(dto, 'user-123');

      const createCall = mockPrisma.devApiKey.create.mock.calls[0][0];
      const storedHash = createCall.data.keyHash;

      // Verify it's a bcrypt hash (starts with $2b$ or $2a$)
      expect(storedHash).toMatch(/^\$2[ab]\$/);
    });
  });

  describe('revokeKey', () => {
    it('should revoke an active key', async () => {
      const mockKey = {
        id: 'key-123',
        orgId: 'org-123',
        status: 'ACTIVE',
      };

      const mockUpdated = {
        id: 'key-123',
        status: 'REVOKED',
        revokedAt: new Date(),
      };

      mockPrisma.devApiKey.findUnique.mockResolvedValue(mockKey);
      mockPrisma.devApiKey.update.mockResolvedValue(mockUpdated);

      const result = await service.revokeKey('key-123', 'org-123');

      expect(result.status).toBe('REVOKED');
      expect(result.revokedAt).toBeDefined();
      expect(mockPrisma.devApiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          status: 'REVOKED',
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if key does not exist', async () => {
      mockPrisma.devApiKey.findUnique.mockResolvedValue(null);

      await expect(service.revokeKey('key-123', 'org-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if orgId does not match', async () => {
      const mockKey = {
        id: 'key-123',
        orgId: 'org-456',
        status: 'ACTIVE',
      };

      mockPrisma.devApiKey.findUnique.mockResolvedValue(mockKey);

      await expect(service.revokeKey('key-123', 'org-123')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if key already revoked', async () => {
      const mockKey = {
        id: 'key-123',
        orgId: 'org-123',
        status: 'REVOKED',
      };

      mockPrisma.devApiKey.findUnique.mockResolvedValue(mockKey);

      await expect(service.revokeKey('key-123', 'org-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listKeys', () => {
    it('should list all keys for an organization', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          orgId: 'org-123',
          environment: 'PRODUCTION',
          status: 'ACTIVE',
          createdBy: { id: 'user-1', email: 'user1@test.com' },
        },
        {
          id: 'key-2',
          name: 'Key 2',
          orgId: 'org-123',
          environment: 'SANDBOX',
          status: 'REVOKED',
          createdBy: { id: 'user-2', email: 'user2@test.com' },
        },
      ];

      mockPrisma.devApiKey.findMany.mockResolvedValue(mockKeys);

      const result = await service.listKeys('org-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.devApiKey.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-123' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });
  });

  describe('verifyKeyForAuth', () => {
    it('should return null for invalid key format', async () => {
      const result = await service.verifyKeyForAuth('invalid-key');
      expect(result).toBeNull();
    });

    it('should return null if no matching key found', async () => {
      mockPrisma.devApiKey.findMany.mockResolvedValue([]);

      const result = await service.verifyKeyForAuth('cc_live_invalidkey123');
      expect(result).toBeNull();
    });

    it('should return key if valid and active', async () => {
      const rawKey = 'cc_live_testkey123';
      const hashedKey = await bcrypt.hash(rawKey, 10);

      const mockKey = {
        id: 'key-123',
        orgId: 'org-123',
        keyHash: hashedKey,
        prefix: 'cc_live_',
        status: 'ACTIVE',
      };

      mockPrisma.devApiKey.findMany.mockResolvedValue([mockKey]);

      const result = await service.verifyKeyForAuth(rawKey);
      expect(result).toEqual(mockKey);
    });

    it('should not return revoked keys', async () => {
      mockPrisma.devApiKey.findMany.mockResolvedValue([]);

      const result = await service.verifyKeyForAuth('cc_live_revokedkey');
      expect(result).toBeNull();
      expect(mockPrisma.devApiKey.findMany).toHaveBeenCalledWith({
        where: {
          prefix: 'cc_live_',
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('recordUsage', () => {
    it('should update lastUsedAt and increment usageCount', async () => {
      mockPrisma.devApiKey.update.mockResolvedValue({});

      await service.recordUsage('key-123');

      expect(mockPrisma.devApiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          lastUsedAt: expect.any(Date),
          usageCount: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('getKeyMetrics', () => {
    it('should calculate metrics for active key', async () => {
      const createdAt = new Date('2025-01-01');
      const lastUsedAt = new Date('2025-01-10');

      const mockKey = {
        id: 'key-123',
        name: 'Test Key',
        environment: 'PRODUCTION',
        status: 'ACTIVE',
        usageCount: 150,
        lastUsedAt,
        createdAt,
        revokedAt: null,
        orgId: 'org-123',
        createdBy: { id: 'user-1' },
      };

      mockPrisma.devApiKey.findUnique.mockResolvedValue(mockKey);

      const result = await service.getKeyMetrics('key-123', 'org-123');

      expect(result.totalRequests).toBe(150);
      expect(result.lastUsedAt).toEqual(lastUsedAt);
      expect(result.daysActive).toBeGreaterThan(0);
    });
  });
});
