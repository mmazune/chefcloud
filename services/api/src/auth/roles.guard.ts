import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

const ROLE_HIERARCHY = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

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
    const userLevel = ROLE_HIERARCHY[user.roleLevel as keyof typeof ROLE_HIERARCHY] || 0;
    return requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0;
      return userLevel >= requiredLevel;
    });
  }
}
