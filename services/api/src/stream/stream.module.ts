import { Module } from '@nestjs/common';
import { StreamController } from './stream.controller';
import { EventsModule } from '../events/events.module';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [StreamController],
  providers: [PrismaService],
  exports: [],
})
export class StreamModule {}
