import { Module } from '@nestjs/common';
import { KdsController } from './kds.controller';
import { KdsService } from './kds.service';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [KdsController],
  providers: [KdsService, PrismaService],
})
export class KdsModule {}
