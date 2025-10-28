import { Module } from '@nestjs/common';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OwnerController],
  providers: [OwnerService, PrismaService],
  exports: [OwnerService],
})
export class OwnerModule {}
