import { Module } from '@nestjs/common';
import { ShiftTemplatesService } from './shift-templates.service';
import { ShiftTemplatesController } from './shift-templates.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [ShiftTemplatesController],
  providers: [ShiftTemplatesService, PrismaService],
  exports: [ShiftTemplatesService],
})
export class ShiftTemplatesModule {}
