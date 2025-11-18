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

@Module({
  imports: [KpisModule],
  controllers: [
    InventoryController,
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
