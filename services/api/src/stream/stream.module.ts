import { Module } from '@nestjs/common';
import { StreamController } from './stream.controller';
import { EventBusService } from '../events/event-bus.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StreamController],
  providers: [EventBusService, PrismaService],
  exports: [EventBusService],
})
export class StreamModule {}
