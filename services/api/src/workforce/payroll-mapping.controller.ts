/**
 * M10.8: Payroll Posting Mapping Controller
 *
 * REST endpoints for managing GL account mappings for payroll.
 * L4+ can view/edit mappings, L5 only can post/pay/void (on payroll-runs controller).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PayrollMappingService, PayrollMappingDto } from './payroll-mapping.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orgs/:orgId/payroll-mapping')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayrollMappingController {
  constructor(private readonly mappingService: PayrollMappingService) {}

  /**
   * GET /orgs/:orgId/payroll-mapping
   * Get effective mapping (optionally for specific branch)
   */
  @Get()
  @Roles('L4', 'L5')
  async getMapping(
    @Param('orgId') orgId: string,
    @Query('branchId') branchId?: string,
  ) {
    const mapping = await this.mappingService.getMapping(orgId, branchId ?? null);
    return { success: true, data: mapping };
  }

  /**
   * GET /orgs/:orgId/payroll-mapping/list
   * List all mappings (org-level + branch overrides)
   */
  @Get('list')
  @Roles('L4', 'L5')
  async listMappings(@Param('orgId') orgId: string) {
    const mappings = await this.mappingService.listMappings(orgId);
    return { success: true, data: mappings };
  }

  /**
   * PUT /orgs/:orgId/payroll-mapping
   * Upsert mapping (create or update)
   */
  @Put()
  @Roles('L4', 'L5')
  async upsertMapping(
    @Param('orgId') orgId: string,
    @Body() dto: PayrollMappingDto,
  ) {
    const result = await this.mappingService.upsertMapping(orgId, dto);
    return { success: true, data: result };
  }

  /**
   * POST /orgs/:orgId/payroll-mapping/initialize
   * Initialize default mapping using standard account codes
   */
  @Post('initialize')
  @Roles('L4', 'L5')
  async initializeDefault(@Param('orgId') orgId: string) {
    const result = await this.mappingService.initializeDefaultMapping(orgId);
    if (!result) {
      return { success: true, message: 'Default mapping already exists', data: null };
    }
    return { success: true, data: result };
  }

  /**
   * DELETE /orgs/:orgId/payroll-mapping/:mappingId
   * Delete a branch-specific mapping (org-level cannot be deleted)
   */
  @Delete(':mappingId')
  @Roles('L4', 'L5')
  async deleteMapping(
    @Param('orgId') orgId: string,
    @Param('mappingId') mappingId: string,
  ) {
    await this.mappingService.deleteMapping(orgId, mappingId);
    return { success: true, message: 'Mapping deleted' };
  }
}
