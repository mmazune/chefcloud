/**
 * M10.7: Compensation Controller
 * 
 * CRUD endpoints for compensation components and employee profiles.
 * RBAC: L4+ for all operations.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CompensationService, CreateComponentDto, UpdateComponentDto, CreateProfileDto, UpdateProfileDto, CompensationComponentType } from './compensation.service';

@Controller('workforce/compensation')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) { }

  // ==================== COMPONENTS ====================

  @Get('components')
  @Roles('L4', 'L5')
  async listComponents(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('enabled') enabled?: string,
    @Query('type') type?: CompensationComponentType,
  ) {
    return this.compensationService.listComponents(req.user.orgId, {
      branchId,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      type,
    });
  }

  @Post('components')
  @Roles('L4', 'L5')
  async createComponent(@Request() req: any, @Body() dto: CreateComponentDto) {
    return this.compensationService.createComponent(req.user.orgId, dto);
  }

  @Get('components/:id')
  @Roles('L4', 'L5')
  async getComponent(@Request() req: any, @Param('id') id: string) {
    return this.compensationService.getComponent(req.user.orgId, id);
  }

  @Patch('components/:id')
  @Roles('L4', 'L5')
  async updateComponent(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.compensationService.updateComponent(req.user.orgId, id, dto);
  }

  @Delete('components/:id')
  @Roles('L4', 'L5')
  async disableComponent(@Request() req: any, @Param('id') id: string) {
    return this.compensationService.disableComponent(req.user.orgId, id);
  }

  // ==================== PROFILES ====================

  @Get('profiles')
  @Roles('L4', 'L5')
  async listProfiles(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('activeOn') activeOn?: string,
  ) {
    return this.compensationService.listProfiles(req.user.orgId, {
      userId,
      activeOn: activeOn ? new Date(activeOn) : undefined,
    });
  }

  @Post('profiles')
  @Roles('L4', 'L5')
  async createProfile(@Request() req: any, @Body() dto: CreateProfileDto) {
    return this.compensationService.createProfile(req.user.orgId, dto);
  }

  @Get('profiles/:id')
  @Roles('L4', 'L5')
  async getProfile(@Request() req: any, @Param('id') id: string) {
    return this.compensationService.getProfile(req.user.orgId, id);
  }

  @Patch('profiles/:id')
  @Roles('L4', 'L5')
  async updateProfile(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.compensationService.updateProfile(req.user.orgId, id, dto);
  }
}
