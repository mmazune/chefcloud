import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Custom throttler guard with intelligent bypass for development/demo scenarios
 * 
 * Defense in depth: Even if @SkipThrottle() decorator is missing,
 * this guard will never throttle /api/health
 * 
 * M7.4D: Added environment-based bypass for non-production or DEMO_VERIFY mode
 * This ensures demo verification scripts don't hit rate limits while production
 * remains protected.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Skip throttling if:
   * 1. NODE_ENV is not 'production' (development, test)
   * 2. DEMO_VERIFY env var is set to 'true' (demo verification mode)
   */
  private readonly skipInDevOrDemo = 
    process.env.NODE_ENV !== 'production' || process.env.DEMO_VERIFY === 'true';

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Skip all throttling in development or demo verification mode
    if (this.skipInDevOrDemo) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Hard bypass for health endpoint - strip query string
    const rawUrl = request.originalUrl ?? request.url ?? '';
    const pathname = rawUrl.split('?')[0];
    
    if (pathname === '/api/health') {
      return true;
    }

    // Delegate to parent class for @SkipThrottle() decorator checks
    return super.shouldSkip(context);
  }
}
