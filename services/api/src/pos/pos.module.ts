import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PrismaService } from '../prisma.service';
import { EfrisModule } from '../efris/efris.module';
import { EventBusService } from '../events/event-bus.service';

@Module({
  imports: [EfrisModule, ConfigModule],
  controllers: [PosController],
  providers: [PosService, PrismaService, EventBusService],
})
export class PosModule {}
