import { Module } from '@nestjs/common';
import { ShiftSchedulesService } from './shift-schedules.service';
import { ShiftSchedulesController } from './shift-schedules.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [ShiftSchedulesController],
  providers: [ShiftSchedulesService, PrismaService],
  exports: [ShiftSchedulesService],
})
export class ShiftSchedulesModule {}
