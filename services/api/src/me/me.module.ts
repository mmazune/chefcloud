import { Module } from '@nestjs/common';
import { MeController, BranchesController } from './me.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MeController, BranchesController],
  providers: [PrismaService],
})
export class MeModule {}
