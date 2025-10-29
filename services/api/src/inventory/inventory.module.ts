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
import { PrismaService } from '../prisma.service';
import { KpisModule } from '../kpis/kpis.module';

@Module({
  imports: [KpisModule],
  controllers: [
    InventoryController,
    RecipesController,
    WastageController,
    CountsController,
  ],
  providers: [
    InventoryService,
    RecipesService,
    WastageService,
    CountsService,
    CostingService,
    PrismaService,
  ],
  exports: [
    InventoryService,
    RecipesService,
    WastageService,
    CountsService,
    CostingService,
  ],
})
export class InventoryModule {}
