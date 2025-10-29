import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../prisma.service';
import { KpisModule } from '../kpis/kpis.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [KpisModule, InventoryModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, PrismaService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
