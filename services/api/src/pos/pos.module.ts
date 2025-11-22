import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PrismaService } from '../prisma.service';
import { EfrisModule } from '../efris/efris.module';
import { EventsModule } from '../events/events.module';
import { InventoryModule } from '../inventory/inventory.module';
import { KpisModule } from '../kpis/kpis.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    EfrisModule,
    ConfigModule,
    EventsModule,
    InventoryModule,
    KpisModule,
    PromotionsModule,
    AccountingModule,
    CommonModule,
  ],
  controllers: [PosController],
  providers: [PosService, PrismaService],
})
export class PosModule {}
