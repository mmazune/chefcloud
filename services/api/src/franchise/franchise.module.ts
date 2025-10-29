import { Module } from '@nestjs/common';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FranchiseController],
  providers: [FranchiseService, PrismaService],
  exports: [FranchiseService],
})
export class FranchiseModule {}
