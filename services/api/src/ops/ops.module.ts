import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OpsController],
  providers: [OpsService, PrismaService],
  exports: [OpsService],
})
export class OpsModule {}
