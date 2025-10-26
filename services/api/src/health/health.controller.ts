import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HealthResponse } from '@chefcloud/contracts';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let dbStatus: 'ok' | 'down' = 'ok';
    
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'down';
    }

    const status = dbStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        database: dbStatus,
      },
    };
  }
}
