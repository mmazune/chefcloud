import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiKeyGuard } from './api-key.guard';
import { PrismaService } from '../prisma.service';
import * as argon2 from 'argon2';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  const mockPrismaService = {
    apiKey: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);

    jest.clearAllMocks();
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as ExecutionContext;
  };

  it('should allow requests with valid API key', async () => {
    const plainKey = 'test-api-key-12345';
    const keyHash = await argon2.hash(plainKey);

    mockConfigService.get.mockReturnValue('production');
    mockPrismaService.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        orgId: 'org-1',
        name: 'Test Key',
        keyHash,
        scopes: ['spout:ingest'],
        createdAt: new Date(),
      },
    ]);

    const context = createMockContext({ 'x-api-key': plainKey });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('should throw UnauthorizedException for missing API key header', async () => {
    mockConfigService.get.mockReturnValue('production');
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Missing X-Api-Key header');
  });

  it('should throw UnauthorizedException for invalid API key', async () => {
    const wrongKey = 'wrong-api-key-99999';
    const keyHash = await argon2.hash('correct-key');

    mockConfigService.get.mockReturnValue('production');
    mockPrismaService.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        orgId: 'org-1',
        name: 'Test Key',
        keyHash,
        scopes: ['spout:ingest'],
        createdAt: new Date(),
      },
    ]);

    const context = createMockContext({ 'x-api-key': wrongKey });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('should bypass validation in dev mode with VERIFY=false', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'VERIFY') return 'false';
      return undefined;
    });

    const context = createMockContext({});
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrismaService.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('should enforce validation in dev mode with VERIFY=true', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'VERIFY') return 'true';
      return undefined;
    });

    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should update lastUsedAt timestamp on successful validation', async () => {
    const plainKey = 'test-key-abc';
    const keyHash = await argon2.hash(plainKey);

    mockConfigService.get.mockReturnValue('production');
    mockPrismaService.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-2',
        orgId: 'org-2',
        name: 'Production Key',
        keyHash,
        scopes: ['webhooks:receive'],
        createdAt: new Date(),
      },
    ]);

    const context = createMockContext({ 'x-api-key': plainKey });
    await guard.canActivate(context);

    expect(mockPrismaService.apiKey.update).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-2' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
