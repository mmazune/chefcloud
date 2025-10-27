import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PrismaService } from '../prisma.service';
import { EfrisModule } from '../efris/efris.module';

@Module({
  imports: [EfrisModule],
  controllers: [PosController],
  providers: [PosService, PrismaService],
})
export class PosModule {}
