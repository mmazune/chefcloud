/**
 * Capabilities Guard
 * 
 * Enforces HIGH risk capability requirements on controller methods.
 * Works with @RequireCapability decorator.
 * 
 * Returns 403 Forbidden if user lacks required capability.
 * 
 * @example
 * ```typescript
 * @Controller('finance/periods')
 * @UseGuards(JwtAuthGuard, CapabilitiesGuard)
 * export class PeriodsController {
 *   @Post(':id/reopen')
 *   @RequireCapability(HighRiskCapability.FINANCE_PERIOD_REOPEN)
 *   async reopen() { ... }
 * }
 * ```
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from './require-capability.decorator';
import { HighRiskCapability, hasCapability } from './capabilities';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredCapabilities = this.reflector.getAllAndOverride<HighRiskCapability[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No capabilities required, allow
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Authentication required for this action');
    }

    const userRoleLevel = user.roleLevel;
    if (!userRoleLevel) {
      throw new ForbiddenException('User role level not available');
    }

    // Check if user has ALL required capabilities
    for (const capability of requiredCapabilities) {
      if (!hasCapability(userRoleLevel, capability)) {
        throw new ForbiddenException(
          `Insufficient permissions: requires ${capability} capability`,
        );
      }
    }

    return true;
  }
}
