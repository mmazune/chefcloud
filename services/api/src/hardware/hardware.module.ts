import { Module } from '@nestjs/common';
import { SpoutController } from './spout.controller';
import { SpoutService } from './spout.service';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [SpoutController],
  providers: [SpoutService, PrismaService],
  exports: [SpoutService],
})
export class HardwareModule {}
