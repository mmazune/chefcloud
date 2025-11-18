import { Module } from '@nestjs/common';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { ShiftAssignmentsController } from './shift-assignments.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [ShiftAssignmentsController],
  providers: [ShiftAssignmentsService, PrismaService],
  exports: [ShiftAssignmentsService],
})
export class ShiftAssignmentsModule {}
