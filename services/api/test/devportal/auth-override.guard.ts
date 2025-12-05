import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Test-only guard that bypasses JWT authentication for E2E tests.
 * Accepts "Bearer TEST_TOKEN" from Authorization header.
 */
@Injectable()
export class TestBypassAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] || '';
    return typeof header === 'string' && header.trim() === 'Bearer TEST_TOKEN';
  }
}
