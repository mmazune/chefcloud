import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [], // ConfigModule is global
  controllers: [AlertsController],
  providers: [AlertsService, PrismaService],
  exports: [AlertsService],
})
export class AlertsModule {}
