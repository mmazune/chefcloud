import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Custom throttler guard with hard bypass for health check endpoint
 * 
 * Defense in depth: Even if @SkipThrottle() decorator is missing,
 * this guard will never throttle /api/health
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
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
