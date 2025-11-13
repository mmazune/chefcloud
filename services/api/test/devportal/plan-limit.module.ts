import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PlanLimitGuard } from './plan-limit.guard';

@Module({
  providers: [{ provide: APP_GUARD, useClass: PlanLimitGuard }],
})
export class PlanLimitTestModule {}
