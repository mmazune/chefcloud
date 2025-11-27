import { Controller, Get, Post, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { TemplatePacksService } from './template-packs.service';
import { CsvImportService, CsvRow } from './csv-import.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

@Controller('inventory/templates')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TemplatesController {
  constructor(private readonly templatePacksService: TemplatePacksService) {}

  /**
   * List available template packs
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Get()
  @Roles('L4', 'L5', 'PROCUREMENT')
  listPacks() {
    return this.templatePacksService.listPacks();
  }

  /**
   * Get a specific template pack
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Get(':packId')
  @Roles('L4', 'L5', 'PROCUREMENT')
  getPack(@Param('packId') packId: string) {
    return this.templatePacksService.getPack(packId);
  }

  /**
   * Apply a template pack to a branch
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Post('apply')
  @Roles('L4', 'L5', 'PROCUREMENT')
  async applyPack(
    @Req() req: Request & { user: any },
    @Body() body: { packId: string; branchId: string },
  ) {
    return this.templatePacksService.applyPack(req.user.orgId, body.branchId, body.packId);
  }
}

@Controller('inventory/import')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ImportController {
  constructor(private readonly csvImportService: CsvImportService) {}

  /**
   * Import inventory from CSV data
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Post()
  @Roles('L4', 'L5', 'PROCUREMENT')
  async importCsv(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId: string,
    @Body() body: { rows: CsvRow[] },
  ) {
    // Validate structure
    const validation = this.csvImportService.validateCsvStructure(body.rows);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // Perform import
    const result = await this.csvImportService.importFromCsv(req.user.orgId, branchId, body.rows);

    return {
      success: result.errors.length === 0,
      ...result,
    };
  }

  /**
   * Get CSV template/example
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Get('template')
  @Roles('L4', 'L5', 'PROCUREMENT')
  getTemplate() {
    return {
      format: 'CSV',
      required_columns: ['item_name', 'unit'],
      optional_columns: [
        'item_sku',
        'category',
        'base_cost',
        'reorder_level',
        'reorder_qty',
        'recipe_parent_sku',
        'recipe_qty',
        'waste_pct',
      ],
      example_rows: [
        {
          category: 'Produce',
          item_name: 'Tomatoes',
          item_sku: 'TOMA-001',
          unit: 'kg',
          base_cost: 3.5,
          reorder_level: 5,
          reorder_qty: 20,
        },
        {
          category: 'Dairy',
          item_name: 'Mozzarella',
          item_sku: 'MOZZ-001',
          unit: 'kg',
          base_cost: 8.0,
          reorder_level: 3,
          reorder_qty: 10,
          recipe_parent_sku: 'PIZZA-MARG',
          recipe_qty: 0.15,
          waste_pct: 2,
        },
      ],
    };
  }
}
