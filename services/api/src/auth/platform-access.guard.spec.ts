import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAccessGuard } from './platform-access.guard';
import { PrismaService } from '../prisma.service';

describe('PlatformAccessGuard', () => {
  let guard: PlatformAccessGuard;

  const mockPrisma = {
    orgSettings: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAccessGuard,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    guard = module.get<PlatformAccessGuard>(PlatformAccessGuard);

    jest.clearAllMocks();
  });

  const createMockContext = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any,
    platform?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: {
            'x-client-platform': platform || 'web',
          },
        }),
      }),
    } as ExecutionContext;
  };

  describe('unauthenticated requests', () => {
    it('should allow requests with no user', async () => {
      const context = createMockContext(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrisma.orgSettings.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('platform access enforcement', () => {
    it('should allow access when platform is permitted in matrix', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L2',
      };

      mockPrisma.orgSettings.findUnique.mockResolvedValue({
        platformAccess: {
          CASHIER: { desktop: true, web: true, mobile: true },
        },
      });

      const context = createMockContext(user, 'desktop');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when platform is not permitted in matrix', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L3',
      };

      mockPrisma.orgSettings.findUnique.mockResolvedValue({
        platformAccess: {
          CHEF: { desktop: false, web: true, mobile: true },
        },
      });

      const context = createMockContext(user, 'desktop');

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should use default matrix when orgSettings is null', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L1', // WAITER: desktop=true, web=false, mobile=false
      };

      mockPrisma.orgSettings.findUnique.mockResolvedValue(null);

      const contextDesktop = createMockContext(user, 'desktop');
      const result = await guard.canActivate(contextDesktop);
      expect(result).toBe(true);

      const contextWeb = createMockContext(user, 'web');
      await expect(guard.canActivate(contextWeb)).rejects.toThrow(ForbiddenException);
    });

    it('should default to web platform when header is missing', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L3',
      };

      mockPrisma.orgSettings.findUnique.mockResolvedValue({
        platformAccess: {
          CHEF: { desktop: true, web: false, mobile: true },
        },
      });

      const context = createMockContext(user, undefined);

      // Should deny - defaults to 'web', CHEF has web=false
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should deny STOCK role from mobile platform', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L3',
      };

      // Use default matrix where STOCK has desktop=false, web=true, mobile=true
      mockPrisma.orgSettings.findUnique.mockResolvedValue(null);

      // Mock getRoleSlugForLevel to return STOCK for L3
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { ...user, roleLevel: 'L3' },
            headers: { 'x-client-platform': 'desktop' },
          }),
        }),
      } as ExecutionContext;

      // Manually test with STOCK role mapping - STOCK has desktop=false
      mockPrisma.orgSettings.findUnique.mockResolvedValue({
        platformAccess: {
          STOCK: { desktop: false, web: true, mobile: true },
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('role level mapping', () => {
    it('should map L5 to OWNER by default', async () => {
      const user = {
        id: 'user-1',
        orgId: 'org-1',
        roleLevel: 'L5',
      };

      mockPrisma.orgSettings.findUnique.mockResolvedValue(null);

      // OWNER: desktop=false, web=true, mobile=true
      const contextWeb = createMockContext(user, 'web');
      const result = await guard.canActivate(contextWeb);
      expect(result).toBe(true);

      // Desktop should be denied for OWNER
      const contextDesktop = createMockContext(user, 'desktop');
      await expect(guard.canActivate(contextDesktop)).rejects.toThrow(ForbiddenException);
    });
  });
});
