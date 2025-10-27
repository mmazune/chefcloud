import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InventoryController, RecipesController, WastageController],
  providers: [InventoryService, RecipesService, WastageService, PrismaService],
  exports: [InventoryService, RecipesService, WastageService],
})
export class InventoryModule {}
