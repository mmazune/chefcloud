import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PosController } from './pos.controller';
import { PosMenuController } from './pos-menu.controller';
import { PosPaymentsController } from './controllers/pos-payments.controller';
import { PosService } from './pos.service';
import { PosMenuService } from './pos-menu.service';
import { PosPaymentsService } from './services/pos-payments.service';
import { PosReceiptsService } from './services/pos-receipts.service';
import { PosCashSessionsService } from './services/pos-cash-sessions.service';
import { PosZReportService } from './services/pos-zreport.service'; // M13.5
import { FakeCardProvider } from './providers/fake-card.provider';
import { PrismaService } from '../prisma.service';
import { EfrisModule } from '../efris/efris.module';
import { EventsModule } from '../events/events.module';
import { InventoryModule } from '../inventory/inventory.module';
import { KpisModule } from '../kpis/kpis.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommonModule } from '../common/common.module';
import { MenuModule } from '../menu/menu.module';
import { KdsModule } from '../kds/kds.module';

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
    forwardRef(() => KdsModule), // M13.3: For KDS ticket generation
  ],
  controllers: [PosMenuController, PosController, PosPaymentsController], // M13.4: Added payments controller
  providers: [
    PosService,
    PosMenuService,
    PosPaymentsService,    // M13.4
    PosReceiptsService,    // M13.4
    PosCashSessionsService, // M13.4
    PosZReportService,     // M13.5
    FakeCardProvider,      // M13.4
    PrismaService,
  ],
  exports: [PosMenuService, PosPaymentsService, PosZReportService], // M13.5: Export z-report service
})
export class PosModule {}
