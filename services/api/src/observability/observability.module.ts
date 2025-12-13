import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { ReadinessService } from './readiness.service';
import { HealthController } from './readiness.controller';

@Global() // Make MetricsService and ReadinessService globally available
@Module({
  providers: [MetricsService, ReadinessService],
  controllers: [MetricsController, HealthController],
  exports: [MetricsService, ReadinessService],
})
export class ObservabilityModule {}
