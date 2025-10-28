import { Module } from '@nestjs/common';
import { KdsController } from './kds.controller';
import { KdsService } from './kds.service';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Module({
  controllers: [KdsController],
  providers: [KdsService, PrismaService, EventBusService],
})
export class KdsModule {}
