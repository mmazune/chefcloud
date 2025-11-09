import { Injectable } from '@nestjs/common';

@Injectable()
export class ReadinessService {
  constructor() {}

  private get prisma(): any {
    try {
      // Access PrismaService instance if available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaService } = require('../prisma.service');
      return PrismaService.instance ?? null;
    } catch {
      return null;
    }
  }

  private get redis(): any {
    return (global as any).__redis || null;
  }

  requiredEnv(): string[] {
    const missing: string[] = [];
    // Required for webhooks
    if (process.env.WH_SECRET_REQUIRED === '1' && !process.env.WH_SECRET) {
      missing.push('WH_SECRET');
    }
    // Required for redis caching if host set
    if (process.env.REDIS_REQUIRED === '1' && !process.env.REDIS_HOST) {
      missing.push('REDIS_HOST');
    }
    return missing;
  }

  async check(): Promise<{ ok: boolean; details: Record<string, any> }> {
    const details: Record<string, any> = {};

    // Prisma ping (optional if not available)
    try {
      if (this.prisma?.$queryRaw) {
        await this.prisma.$queryRaw`SELECT 1`;
        details.db = 'ok';
      } else {
        details.db = 'skipped';
      }
    } catch (e: any) {
      details.db = `error:${e?.message ?? e}`;
    }

    // Redis ping & roundtrip
    try {
      if (this.redis?.setEx && this.redis?.get) {
        const key = `rdz:ready:${Date.now()}`;
        await this.redis.setEx(key, 5, '1');
        const v = await this.redis.get(key);
        details.redis = v === '1' ? 'ok' : 'error:roundtrip';
      } else {
        details.redis = 'skipped';
      }
    } catch (e: any) {
      details.redis = `error:${e?.message ?? e}`;
    }

    const missing = this.requiredEnv();
    if (missing.length) {
      details.env = `missing:${missing.join(',')}`;
    } else {
      details.env = 'ok';
    }

    const ok = Object.values(details).every(
      (v) => String(v).startsWith('ok') || String(v) === 'skipped',
    );
    return { ok, details };
  }
}
