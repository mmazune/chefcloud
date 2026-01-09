import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';

/**
 * DI Token classes for overriding guards in tests.
 * These match the class names from the quarantined dev-portal module.
 * Tests use these as tokens with { provide: DevAdminGuard, useClass: TestDevAdminGuard }
 */
@Injectable()
export class DevAdminGuard implements CanActivate {
  canActivate(): boolean {
    // This is a placeholder — tests override with TestDevAdminGuard
    return false;
  }
}

@Injectable()
export class SuperDevGuard implements CanActivate {
  canActivate(): boolean {
    // This is a placeholder — tests override with TestSuperDevGuard
    return false;
  }
}

/**
 * Test stub for DevAdminGuard - NO dependency injection needed.
 * Validates x-dev-admin header and mocks devAdmin based on known test emails.
 */
@Injectable()
export class TestDevAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const devAdminEmail = request.headers['x-dev-admin'];

    if (!devAdminEmail) {
      throw new UnauthorizedException('Missing X-Dev-Admin header');
    }

    // Mock devAdmin based on known test emails (matches Prisma stub)
    const knownDevAdmins = {
      'dev1@chefcloud.local': { id: 'devadmin_1', email: 'dev1@chefcloud.local', isSuper: false },
      'superdev@chefcloud.local': { id: 'devadmin_super', email: 'superdev@chefcloud.local', isSuper: true },
      'lastsuperdev@chefcloud.local': { id: 'devadmin_last', email: 'lastsuperdev@chefcloud.local', isSuper: true },
      'regulardev@chefcloud.local': { id: 'devadmin_regular', email: 'regulardev@chefcloud.local', isSuper: false },
    };

    const devAdmin = knownDevAdmins[devAdminEmail as keyof typeof knownDevAdmins];

    if (!devAdmin) {
      throw new UnauthorizedException('Invalid dev admin');
    }

    request.devAdmin = devAdmin;
    return true;
  }
}

/**
 * Test stub for SuperDevGuard that checks the devAdmin.isSuper property.
 */
@Injectable()
export class TestSuperDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const devAdmin = request.devAdmin;

    if (!devAdmin || !devAdmin.isSuper) {
      throw new ForbiddenException('Super dev admin access required');
    }

    return true;
  }
}
