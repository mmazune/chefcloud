import { Module } from '@nestjs/common';
import { FloorController, TableController } from './floor.controller';
import { FloorService } from './floor.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FloorController, TableController],
  providers: [FloorService, PrismaService],
})
export class FloorModule {}
