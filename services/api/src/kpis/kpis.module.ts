import { Module } from '@nestjs/common';
import { KpisController } from './kpis.controller';
import { KpisService } from './kpis.service';
import { PrismaService } from '../prisma.service';
import { SseRateLimiterGuard } from '../common/sse-rate-limiter.guard';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [ObservabilityModule],
  controllers: [KpisController],
  providers: [KpisService, PrismaService, SseRateLimiterGuard],
  exports: [KpisService],
})
export class KpisModule {}
