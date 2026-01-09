import { Module } from '@nestjs/common';
import { DevPortalController } from './dev-portal.controller';
import { DevPortalService } from './dev-portal.service';
import { PrismaService } from '../prisma.service';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';
import { DevPortalKeyRepo } from './ports/devportal.port';
import { DevPortalPrismaRepo } from './repo/devportal.prisma.adapter';

@Module({
  controllers: [DevPortalController],
  providers: [
    DevPortalService,
    PrismaService,
    PlanRateLimiterGuard,
    // DevAdminGuard and SuperDevGuard are NOT provided here
    // They are instantiated on-demand by @UseGuards decorator
    // This allows test overrides to work properly
    { provide: DevPortalKeyRepo, useClass: DevPortalPrismaRepo },
  ],
})
export class DevPortalModule {}
