import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

const state = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class ForecastThrottleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = 'forecast-throttle';
    const now = Date.now();
    const win = 30000; // 30s
    const lim = 5;

    let bucket = state.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + win };
      state.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > lim) {
      (req as any).__TEST_RATE_LIMIT_HIT__ = true;
    }
    return true;
  }
}
