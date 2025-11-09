import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { PrismaService } from '../prisma.service';
import { FeatureFlagsService } from './feature-flags.service';
import { MaintenanceService } from './maintenance.service';
import { FeatureFlagGuard } from './feature-flag.guard';

@Module({
  controllers: [OpsController],
  providers: [OpsService, PrismaService, FeatureFlagsService, MaintenanceService, FeatureFlagGuard],
  exports: [OpsService, FeatureFlagsService, MaintenanceService, FeatureFlagGuard],
})
export class OpsModule {}
