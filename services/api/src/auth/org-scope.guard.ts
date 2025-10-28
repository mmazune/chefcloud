import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

/**
 * OrgScopeGuard - Ensures multi-tenant isolation
 * 
 * Validates that:
 * 1. x-org-id header is present
 * 2. x-org-id matches the authenticated user's orgId from JWT
 * 
 * Apply to all authenticated endpoints to prevent cross-org data access
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  private readonly logger = new Logger(OrgScopeGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Guard should only be used after auth guard
    if (!user) {
      this.logger.warn('OrgScopeGuard used without authentication');
      throw new ForbiddenException('Authentication required');
    }

    const orgIdHeader = request.headers['x-org-id'];

    // Require x-org-id header
    if (!orgIdHeader) {
      throw new BadRequestException('Missing x-org-id header');
    }

    // Validate orgId matches user's org
    if (orgIdHeader !== user.orgId) {
      this.logger.warn(
        `Org scope violation: user ${user.userId} (org ${user.orgId}) attempted to access org ${orgIdHeader}`,
      );
      throw new ForbiddenException('Access to this organization is denied');
    }

    // Attach validated orgId to request for easy access
    request.orgId = orgIdHeader;

    return true;
  }
}
