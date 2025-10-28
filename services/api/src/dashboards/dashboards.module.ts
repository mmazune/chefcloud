import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DashboardsController],
  providers: [DashboardsService, PrismaService],
})
export class DashboardsModule {}
