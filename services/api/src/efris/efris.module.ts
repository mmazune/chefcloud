import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EfrisService } from './efris.service';
import { EfrisController } from './efris.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [], // ConfigModule is global
  controllers: [EfrisController],
  providers: [EfrisService, PrismaService],
  exports: [EfrisService],
})
export class EfrisModule {}
