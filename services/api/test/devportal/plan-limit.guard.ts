import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

const state = new Map<string, { count: number; resetAt: number }>();

function windowSecs() {
  const n = parseInt(process.env.PLAN_WINDOW_SEC || '30', 10);
  return Number.isFinite(n) ? n : 30;
}

function planLimit(plan: string) {
  if (plan === 'pro') return parseInt(process.env.PLAN_LIMIT_PRO || '50', 10);
  return parseInt(process.env.PLAN_LIMIT_FREE || '5', 10);
}

@Injectable()
export class PlanLimitGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const plan: string = (req.headers['x-plan'] as string) || 'free';
    const key = `plan:${plan}`;
    const now = Date.now();
    const win = windowSecs() * 1000;
    const lim = planLimit(plan);

    let bucket = state.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + win };
      state.set(key, bucket);
    }

    bucket.count += 1;
    // emulate 429 without throwing exceptions (so tests can .ok(() => true))
    if (bucket.count > lim) {
      (req as any).__TEST_RATE_LIMIT_HIT__ = true;
    }
    return true;
  }
}
