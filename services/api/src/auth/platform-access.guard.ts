import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { ROLE_TO_LEVEL } from './role-constants';
import { ALLOWED_PLATFORMS_KEY } from './allowed-platforms.decorator';

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
  private readonly logger = new Logger(PlatformAccessGuard.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip if no user (unauthenticated routes)
    if (!user) {
      return true;
    }

    // M10: Check @AllowedPlatforms decorator first (highest priority)
    const allowedPlatforms = this.reflector.getAllAndOverride<string[]>(ALLOWED_PLATFORMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowedPlatforms && allowedPlatforms.length > 0) {
      // M10: Get platform from JWT claim (most secure)
      const jwtPlatform = user.platform; // From JWT payload

      if (!jwtPlatform) {
        // Backwards compat: Fall back to header if no JWT platform
        const headerPlatform = this.normalizePlatform(request.headers['x-client-platform']);
        if (!allowedPlatforms.includes(headerPlatform)) {
          throw new ForbiddenException({
            code: 'PLATFORM_FORBIDDEN',
            message: `This endpoint requires one of: ${allowedPlatforms.join(', ')}`,
            platform: headerPlatform,
            allowedPlatforms,
          });
        }
        return true;
      }

      // Validate JWT platform matches allowed list
      if (!allowedPlatforms.includes(jwtPlatform)) {
        throw new ForbiddenException({
          code: 'PLATFORM_FORBIDDEN',
          message: `This endpoint requires one of: ${allowedPlatforms.join(', ')}`,
          platform: jwtPlatform,
          allowedPlatforms,
        });
      }

      // M10: Anti-spoofing - validate JWT claim matches header
      const headerPlatform = this.normalizePlatform(request.headers['x-client-platform']);
      if (headerPlatform !== jwtPlatform && headerPlatform !== 'OTHER') {
        this.logger.warn(
          `Platform spoofing attempt: JWT=${jwtPlatform}, Header=${headerPlatform} for user ${user.userId}`,
        );
        throw new ForbiddenException({
          code: 'PLATFORM_MISMATCH',
          message: 'Platform claim does not match request',
        });
      }

      return true;
    }

    // Legacy E23-s3: Role-based platform access (backwards compatibility)
    const headerPlatform = this.normalizeToLegacyPlatform(request.headers['x-client-platform']);

    // Validate platform value
    if (!['web', 'desktop', 'mobile'].includes(headerPlatform)) {
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
    if (!roleAccess || !roleAccess[headerPlatform as keyof PlatformAccess]) {
      throw new ForbiddenException({
        code: 'PLATFORM_FORBIDDEN',
        message: `Access denied for ${headerPlatform} platform`,
        role: roleSlug,
        platform: headerPlatform,
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

  /**
   * M10: Normalize platform header to M10 enum values
   */
  private normalizePlatform(headerValue: string | undefined): string {
    if (!headerValue) return 'OTHER';

    const normalized = headerValue.toUpperCase();

    // Map legacy values to M10 enum
    const mapping: Record<string, string> = {
      WEB: 'WEB_BACKOFFICE',
      DESKTOP: 'POS_DESKTOP',
      MOBILE: 'MOBILE_APP',
      KDS: 'KDS_SCREEN',
      DEV: 'DEV_PORTAL',
      // Direct matches
      WEB_BACKOFFICE: 'WEB_BACKOFFICE',
      POS_DESKTOP: 'POS_DESKTOP',
      MOBILE_APP: 'MOBILE_APP',
      KDS_SCREEN: 'KDS_SCREEN',
      DEV_PORTAL: 'DEV_PORTAL',
    };

    return mapping[normalized] || 'OTHER';
  }

  /**
   * Legacy: Normalize to old platform values for E23-s3 compatibility
   */
  private normalizeToLegacyPlatform(headerValue: string | undefined): string {
    if (!headerValue) return 'web';

    const normalized = headerValue.toLowerCase();

    const mapping: Record<string, string> = {
      web_backoffice: 'web',
      pos_desktop: 'desktop',
      mobile_app: 'mobile',
      kds_screen: 'desktop', // KDS uses desktop permissions
      dev_portal: 'web', // Dev portal uses web permissions
    };

    return mapping[normalized] || normalized;
  }
}
