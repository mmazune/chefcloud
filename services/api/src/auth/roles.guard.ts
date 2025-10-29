import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { ROLE_HIERARCHY, ROLE_TO_LEVEL, RoleSlug, RoleLevel } from './role-constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // L5 (Owner) can access everything
    if (user.roleLevel === 'L5') {
      return true;
    }

    // Check if user's role level meets minimum requirement
    const userLevel = ROLE_HIERARCHY[user.roleLevel as RoleLevel] || 0;
    return requiredRoles.some((role) => {
      // Support both level-based (L1-L5) and named roles (WAITER, PROCUREMENT, etc.)
      const roleLevel = (role as RoleLevel) in ROLE_HIERARCHY 
        ? (role as RoleLevel)
        : ROLE_TO_LEVEL[role as RoleSlug];
      
      const requiredLevel = ROLE_HIERARCHY[roleLevel as RoleLevel] || 0;
      return userLevel >= requiredLevel;
    });
  }
}
