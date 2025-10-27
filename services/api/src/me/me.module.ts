import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MeController],
  providers: [PrismaService],
})
export class MeModule {}
