import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';
import { CostingService } from './costing.service';
import { PrismaService } from '../prisma.service';
import { KpisModule } from '../kpis/kpis.module';

@Module({
  imports: [KpisModule],
  controllers: [InventoryController, RecipesController, WastageController],
  providers: [InventoryService, RecipesService, WastageService, CostingService, PrismaService],
  exports: [InventoryService, RecipesService, WastageService, CostingService],
})
export class InventoryModule {}
