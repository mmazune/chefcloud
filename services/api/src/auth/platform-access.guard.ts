import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ROLE_TO_LEVEL } from './role-constants';

type PlatformAccess = {
  desktop: boolean;
  web: boolean;
  mobile: boolean;
};

type PlatformAccessMatrix = Record<string, PlatformAccess>;

const DEFAULT_PLATFORM_ACCESS: PlatformAccessMatrix = {
  WAITER: { desktop: true, web: false, mobile: false },
  CASHIER: { desktop: true, web: false, mobile: false },
  SUPERVISOR: { desktop: true, web: false, mobile: false },
  TICKET_MASTER: { desktop: true, web: false, mobile: false },
  ASSISTANT_CHEF: { desktop: true, web: false, mobile: true },
  CHEF: { desktop: true, web: false, mobile: true },
  HEAD_CHEF: { desktop: true, web: false, mobile: true },
  STOCK: { desktop: false, web: true, mobile: true },
  PROCUREMENT: { desktop: false, web: true, mobile: false },
  ASSISTANT_MANAGER: { desktop: false, web: true, mobile: true },
  EVENT_MANAGER: { desktop: false, web: true, mobile: true },
  HEAD_BARISTA: { desktop: true, web: false, mobile: true },
  MANAGER: { desktop: false, web: true, mobile: true },
  ACCOUNTANT: { desktop: false, web: true, mobile: true },
  OWNER: { desktop: false, web: true, mobile: true },
  ADMIN: { desktop: false, web: true, mobile: true },
  DEV_ADMIN: { desktop: false, web: true, mobile: false },
};

@Injectable()
export class PlatformAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip if no user (unauthenticated routes)
    if (!user) {
      return true;
    }

    // Extract platform from header (default to web)
    const platform = (request.headers['x-client-platform'] || 'web') as string;

    // Validate platform value
    if (!['web', 'desktop', 'mobile'].includes(platform)) {
      return true; // Allow invalid platform values to pass, default to web behavior
    }

    // Get org settings with platform access matrix
    const orgSettings = await this.prisma.orgSettings.findUnique({
      where: { orgId: user.orgId },
      select: { platformAccess: true },
    });

    const platformAccess =
      (orgSettings?.platformAccess as typeof DEFAULT_PLATFORM_ACCESS) || DEFAULT_PLATFORM_ACCESS;

    // Map user roleLevel to role slug
    const roleSlug = this.getRoleSlugForLevel(user.roleLevel);

    // Check if platform is allowed for this role
    const roleAccess = platformAccess[roleSlug];
    if (!roleAccess || !roleAccess[platform as keyof PlatformAccess]) {
      throw new ForbiddenException({
        code: 'PLATFORM_FORBIDDEN',
        message: `Access denied for ${platform} platform`,
        role: roleSlug,
        platform,
      });
    }

    return true;
  }

  private getRoleSlugForLevel(roleLevel: string): string {
    // Find first role that matches this level
    for (const [slug, level] of Object.entries(ROLE_TO_LEVEL)) {
      if (level === roleLevel) {
        return slug;
      }
    }

    // Default mapping by level
    const levelMap: Record<string, string> = {
      L1: 'WAITER',
      L2: 'CASHIER',
      L3: 'CHEF',
      L4: 'MANAGER',
      L5: 'OWNER',
    };

    return levelMap[roleLevel] || 'WAITER';
  }
}
