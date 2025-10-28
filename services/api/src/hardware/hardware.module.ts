import { Module } from '@nestjs/common';
import { SpoutController } from './spout.controller';
import { SpoutService } from './spout.service';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Module({
  controllers: [SpoutController],
  providers: [SpoutService, PrismaService, EventBusService],
  exports: [SpoutService],
})
export class HardwareModule {}
