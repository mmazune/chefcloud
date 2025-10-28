import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma.service';

describe('SupportService', () => {
  let service: SupportService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: PrismaService,
          useValue: {
            supportSession: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session with 15-minute expiry', async () => {
      const mockSession = {
        id: 'test-session-id',
        orgId: 'org-1',
        createdById: 'user-1',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.supportSession, 'create').mockResolvedValue(mockSession as any);

      const result = await service.createSession('user-1', 'org-1');

      expect(result.id).toBe('test-session-id');
      expect(result.isActive).toBe(true);
      expect(prisma.supportSession.create).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should return null for expired token', async () => {
      const expiredSession = {
        id: 'expired-session',
        orgId: 'org-1',
        createdById: 'user-1',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        isActive: true,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.supportSession, 'findUnique').mockResolvedValue(expiredSession as any);

      const result = await service.validateToken('expired-token');

      expect(result).toBeNull();
    });

    it('should return null for inactive session', async () => {
      const inactiveSession = {
        id: 'inactive-session',
        orgId: 'org-1',
        createdById: 'user-1',
        token: 'inactive-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isActive: false,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.supportSession, 'findUnique').mockResolvedValue(inactiveSession as any);

      const result = await service.validateToken('inactive-token');

      expect(result).toBeNull();
    });

    it('should return session for valid token', async () => {
      const validSession = {
        id: 'valid-session',
        orgId: 'org-1',
        createdById: 'user-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.supportSession, 'findUnique').mockResolvedValue(validSession as any);

      const result = await service.validateToken('valid-token');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('valid-session');
    });
  });
});
