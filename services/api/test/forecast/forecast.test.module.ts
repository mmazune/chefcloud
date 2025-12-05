import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ForecastTestController } from './forecast.test.controller';
import { ForecastThrottleGuard } from './throttle.guard';

@Module({
  controllers: [ForecastTestController],
  providers: [{ provide: APP_GUARD, useClass: ForecastThrottleGuard }],
})
export class ForecastTestModule {}
