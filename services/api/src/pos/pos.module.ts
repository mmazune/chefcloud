import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PosController } from './pos.controller';
import { PosMenuController } from './pos-menu.controller';
import { PosService } from './pos.service';
import { PosMenuService } from './pos-menu.service';
import { PrismaService } from '../prisma.service';
import { EfrisModule } from '../efris/efris.module';
import { EventsModule } from '../events/events.module';
import { InventoryModule } from '../inventory/inventory.module';
import { KpisModule } from '../kpis/kpis.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommonModule } from '../common/common.module';
import { MenuModule } from '../menu/menu.module';

@Module({
  imports: [
    EfrisModule,
    // ConfigModule is global
    EventsModule,
    InventoryModule,
    KpisModule,
    PromotionsModule,
    AccountingModule,
    CommonModule,
    MenuModule, // M13.2: For menu availability checking
  ],
  controllers: [PosMenuController, PosController], // Menu controller first to avoid route shadowing
  providers: [PosService, PosMenuService, PrismaService],
  exports: [PosMenuService], // M13.2: Export for use in POS service
})
export class PosModule {}
