import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services?: {
    database: 'ok' | 'down';
    redis: 'ok' | 'down';
  };
}

@SkipThrottle()
@Controller('api/health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @SkipThrottle()
  @Get()
  async check(): Promise<HealthResponse> {
    let dbStatus: 'ok' | 'down' = 'ok';
    let redisStatus: 'ok' | 'down' = 'ok';
    
    // Check database (non-fatal)
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'down';
    }

    // Check Redis (non-fatal)
    try {
      const isHealthy = await this.redis.isHealthy();
      redisStatus = isHealthy ? 'ok' : 'down';
    } catch (error) {
      redisStatus = 'down';
    }

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }
}
