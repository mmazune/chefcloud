import { Module } from '@nestjs/common';
import { ThresholdsController } from './thresholds.controller';
import { ThresholdsService } from './thresholds.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ThresholdsController],
  providers: [ThresholdsService, PrismaService],
  exports: [ThresholdsService],
})
export class ThresholdsModule {}
