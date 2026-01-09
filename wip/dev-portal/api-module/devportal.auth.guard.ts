import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Dev-Portal scoped auth guard with test bypass capability.
 * 
 * Production: Delegates to JWT auth guard (E2E_AUTH_BYPASS unset or '0')
 * Test: Accepts 'Bearer TEST_TOKEN' when E2E_AUTH_BYPASS='1'
 * 
 * This guard is scoped to DevPortal routes only and does not affect
 * other API endpoints.
 */
@Injectable()
export class DevPortalAuthGuard implements CanActivate {
  private jwtGuard: CanActivate | null = null;

  constructor() {
    // Only instantiate JWT guard if not in test bypass mode
    // This avoids needing AuthModule in tests
    if (process.env.E2E_AUTH_BYPASS !== '1') {
      this.jwtGuard = new (AuthGuard('jwt'))();
    }
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Test-mode bypass (env-gated, default OFF)
    // Explicit opt-in for E2E slices only
    if (process.env.E2E_AUTH_BYPASS === '1') {
      const req = ctx.switchToHttp().getRequest();
      const auth = (req?.headers?.['authorization'] ?? '').toString().trim();
      if (auth !== 'Bearer TEST_TOKEN') {
        throw new UnauthorizedException();
      }
      return true;
    }

    // Default: delegate to real JWT guard (AuthGuard('jwt'))
    if (!this.jwtGuard) {
      throw new UnauthorizedException('JWT guard not initialized');
    }
    const result = await (this.jwtGuard as any).canActivate(ctx);
    return result as boolean;
  }
}

