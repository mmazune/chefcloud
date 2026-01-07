import { Module } from '@nestjs/common';
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

// M11.3 Transfers + Waste imports
import { InventoryTransfersController } from './inventory-transfers.controller';
import { InventoryTransfersService } from './inventory-transfers.service';
import { InventoryWasteController } from './inventory-waste.controller';
import { InventoryWasteService } from './inventory-waste.service';

// M11.4 Recipes + Depletion imports
import { InventoryRecipesController } from './inventory-recipes.controller';
import { InventoryRecipesService } from './inventory-recipes.service';
import { InventoryDepletionController } from './inventory-depletion.controller';
import { InventoryDepletionService } from './inventory-depletion.service';

// M11.5 Costing + Valuation + COGS imports
import { InventoryCostingController } from './inventory-costing.controller';
import { InventoryCostingService } from './inventory-costing.service';

// M11.6 Supplier Catalog + Pricing + Reorder imports
import { SupplierCatalogController } from './supplier-catalog.controller';
import { SupplierCatalogService } from './supplier-catalog.service';
import { SupplierPricingService } from './supplier-pricing.service';
import { ReorderEngineService } from './reorder-engine.service';
import { ReorderPoGeneratorService } from './reorder-po-generator.service';

// M11.7 Lots + Expiry + Traceability imports
import { InventoryLotsController } from './inventory-lots.controller';
import { InventoryLotsService } from './inventory-lots.service';

// M11.8 Vendor Returns + Recalls + Expiry Enforcement imports
import { InventoryVendorReturnsController } from './inventory-vendor-returns.controller';
import { InventoryVendorReturnsService } from './inventory-vendor-returns.service';
import { InventoryRecallsController } from './inventory-recalls.controller';
import { InventoryRecallsService } from './inventory-recalls.service';
import { InventoryExpiryController } from './inventory-expiry.controller';
import { InventoryExpiryService } from './inventory-expiry.service';

// M11.9 Production Batches imports
import { InventoryProductionController } from './inventory-production.controller';
import { InventoryProductionService } from './inventory-production.service';

// M11.10 Stocktake v2 imports
import { InventoryStocktakeController } from './inventory-stocktake.controller';
import { InventoryStocktakeService } from './inventory-stocktake.service';

// M11.11 Barcodes + Fast Ops imports
import { InventoryBarcodesController } from './inventory-barcodes.controller';
import { InventoryBarcodesService } from './inventory-barcodes.service';
import { InventoryFastOpsController } from './inventory-fast-ops.controller';
import { InventoryFastOpsService } from './inventory-fast-ops.service';

// M11.12 Analytics + Alerts imports
import { InventoryAnalyticsController } from './inventory-analytics.controller';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { InventoryAlertsController } from './inventory-alerts.controller';
import { InventoryAlertsService } from './inventory-alerts.service';

// M11.13 GL Integration imports
import { InventoryGlController } from './inventory-gl.controller';
import { InventoryPostingMappingService } from './inventory-posting-mapping.service';
import { InventoryGlPostingService } from './inventory-gl-posting.service';

// M11.14 Demand Forecasting + Reorder Optimization imports
import { InventoryForecastingController } from './inventory-forecasting.controller';
import { InventoryDemandSeriesService } from './inventory-demand-series.service';
import { InventoryForecastingService } from './inventory-forecasting.service';
import { InventoryReorderOptimizationService } from './inventory-reorder-optimization.service';

// M11.15 Inventory Health Report imports
import { InventoryHealthController } from './inventory-health.controller';
import { InventoryHealthService } from './inventory-health.service';

// M12.1 Inventory Periods imports
import { InventoryPeriodsController } from './inventory-periods.controller';
import { InventoryPeriodsService } from './inventory-periods.service';
import { InventoryReconciliationService as InventoryPeriodReconciliationService } from './inventory-reconciliation.service';
import { InventoryPeriodExportService } from './inventory-period-export.service';

@Module({
  imports: [KpisModule, AuditModule],
  controllers: [
    InventoryController,
    InventoryFoundationController, // M11.1
    ProcurementController, // M11.2
    InventoryTransfersController, // M11.3
    InventoryWasteController, // M11.3
    InventoryRecipesController, // M11.4
    InventoryDepletionController, // M11.4
    InventoryCostingController, // M11.5
    SupplierCatalogController, // M11.6
    InventoryLotsController, // M11.7
    InventoryVendorReturnsController, // M11.8
    InventoryRecallsController, // M11.8
    InventoryExpiryController, // M11.8
    InventoryProductionController, // M11.9
    InventoryStocktakeController, // M11.10
    InventoryBarcodesController, // M11.11
    InventoryFastOpsController, // M11.11
    InventoryAnalyticsController, // M11.12
    InventoryAlertsController, // M11.12
    InventoryGlController, // M11.13
    InventoryForecastingController, // M11.14
    InventoryHealthController, // M11.15
    InventoryPeriodsController, // M12.1
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
    InventoryTransfersService, // M11.3
    InventoryWasteService, // M11.3
    InventoryRecipesService, // M11.4
    InventoryDepletionService, // M11.4
    InventoryCostingService, // M11.5
    SupplierCatalogService, // M11.6
    SupplierPricingService, // M11.6
    ReorderEngineService, // M11.6
    ReorderPoGeneratorService, // M11.6
    InventoryLotsService, // M11.7
    InventoryVendorReturnsService, // M11.8
    InventoryRecallsService, // M11.8
    InventoryExpiryService, // M11.8
    InventoryProductionService, // M11.9
    InventoryStocktakeService, // M11.10
    InventoryBarcodesService, // M11.11
    InventoryFastOpsService, // M11.11
    InventoryAnalyticsService, // M11.12
    InventoryAlertsService, // M11.12
    InventoryPostingMappingService, // M11.13
    InventoryGlPostingService, // M11.13
    InventoryDemandSeriesService, // M11.14
    InventoryForecastingService, // M11.14
    InventoryReorderOptimizationService, // M11.14
    InventoryHealthService, // M11.15
    InventoryPeriodsService, // M12.1
    InventoryPeriodReconciliationService, // M12.1
    InventoryPeriodExportService, // M12.1
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
    InventoryTransfersService, // M11.3
    InventoryWasteService, // M11.3
    InventoryRecipesService, // M11.4
    InventoryDepletionService, // M11.4
    InventoryCostingService, // M11.5
    SupplierCatalogService, // M11.6
    SupplierPricingService, // M11.6
    ReorderEngineService, // M11.6
    ReorderPoGeneratorService, // M11.6
    InventoryLotsService, // M11.7
    InventoryVendorReturnsService, // M11.8
    InventoryRecallsService, // M11.8
    InventoryExpiryService, // M11.8
    InventoryProductionService, // M11.9
    InventoryStocktakeService, // M11.10
    InventoryBarcodesService, // M11.11
    InventoryFastOpsService, // M11.11
    InventoryAnalyticsService, // M11.12
    InventoryAlertsService, // M11.12
    InventoryPostingMappingService, // M11.13
    InventoryGlPostingService, // M11.13
    InventoryDemandSeriesService, // M11.14
    InventoryForecastingService, // M11.14
    InventoryReorderOptimizationService, // M11.14
    InventoryHealthService, // M11.15
    InventoryPeriodsService, // M12.1
    InventoryPeriodReconciliationService, // M12.1
    InventoryPeriodExportService, // M12.1
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
export class InventoryModule { }
