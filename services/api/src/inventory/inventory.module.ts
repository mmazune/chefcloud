import { Module, forwardRef } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';
import { CountsController } from './counts.controller';
import { CountsService } from './counts.service';
import { CostingService } from './costing.service';
import { StockMovementsService } from './stock-movements.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { LowStockAlertsService } from './low-stock-alerts.service';
import { LowStockAlertsController } from './low-stock-alerts.controller';
import { TemplatePacksService } from './template-packs.service';
import { CsvImportService } from './csv-import.service';
import { TemplatesController, ImportController } from './templates.controller';
import { PrismaService } from '../prisma.service';
import { KpisModule } from '../kpis/kpis.module';
import { AuditModule } from '../audit/audit.module';

// M11.1 Inventory Foundation imports
import { InventoryFoundationController } from './inventory-foundation.controller';
import { InventoryUomService } from './inventory-uom.service';
import { InventoryLocationsService } from './inventory-locations.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { InventoryCountsService } from './inventory-counts.service';
import { InventoryExportService } from './inventory-export.service';

// M11.2 Procurement imports
import { ProcurementController } from './procurement.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ReceiptsService } from './receipts.service';
import { ProcurementReportingService } from './procurement-reporting.service';

@Module({
  imports: [KpisModule, AuditModule],
  controllers: [
    InventoryController,
    InventoryFoundationController, // M11.1
    ProcurementController, // M11.2
    RecipesController,
    WastageController,
    CountsController,
    ReconciliationController,
    LowStockAlertsController,
    TemplatesController,
    ImportController,
  ],
  providers: [
    InventoryService,
    InventoryUomService, // M11.1
    InventoryLocationsService, // M11.1
    InventoryLedgerService, // M11.1
    InventoryAdjustmentsService, // M11.1
    InventoryCountsService, // M11.1
    InventoryExportService, // M11.1
    PurchaseOrdersService, // M11.2
    ReceiptsService, // M11.2
    ProcurementReportingService, // M11.2
    RecipesService,
    WastageService,
    CountsService,
    CostingService,
    StockMovementsService,
    ReconciliationService,
    LowStockAlertsService,
    TemplatePacksService,
    CsvImportService,
    PrismaService,
  ],
  exports: [
    InventoryService,
    InventoryUomService, // M11.1
    InventoryLocationsService, // M11.1
    InventoryLedgerService, // M11.1
    InventoryAdjustmentsService, // M11.1
    InventoryCountsService, // M11.1
    InventoryExportService, // M11.1
    PurchaseOrdersService, // M11.2
    ReceiptsService, // M11.2
    ProcurementReportingService, // M11.2
    RecipesService,
    WastageService,
    CountsService,
    CostingService,
    StockMovementsService,
    ReconciliationService,
    LowStockAlertsService,
    TemplatePacksService,
    CsvImportService,
  ],
})
export class InventoryModule {}
