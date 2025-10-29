/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, Req, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OpsService } from './ops.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { MaintenanceService } from './maintenance.service';

class CreateApiKeyDto {
  name!: string;
  scopes!: string[];
}

@Controller('ops')
export class OpsController {
  constructor(
    private opsService: OpsService,
    private readonly flagsService: FeatureFlagsService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  @Get('health')
  async getHealth() {
    return this.opsService.getHealthStatus();
  }

  // E54-s1: Readiness probe for K8s/Docker
  @Get('ready')
  async getReadiness() {
    return this.opsService.getReadiness();
  }

  @Get('metrics')
  async getMetrics() {
    const metricsText = this.opsService.getMetrics();
    return metricsText;
  }

  @Post('diag/snapshot')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async createDiagSnapshot(@Req() req: any) {
    return this.opsService.createDiagSnapshot(req.user.userId);
  }

  @Post('apikeys')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async createApiKey(@Req() req: any, @Body() dto: CreateApiKeyDto): Promise<any> {
    return this.opsService.createApiKey(req.user.orgId, dto.name, dto.scopes);
  }

  @Get('apikeys')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async listApiKeys(@Req() req: any): Promise<any> {
    return this.opsService.listApiKeys(req.user.orgId);
  }

  @Delete('apikeys/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async deleteApiKey(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.opsService.deleteApiKey(req.user.orgId, id);
  }

  // ===== E49-s1: Feature Flags =====

  @Post('flags')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async createOrUpdateFlag(@Body() body: any, @Request() req: any) {
    return this.flagsService.upsert(
      body.key,
      {
        orgId: body.orgId,
        description: body.description,
        active: body.active,
        rolloutPct: body.rolloutPct,
        scopes: body.scopes,
      },
      req.user?.id,
    );
  }

  @Get('flags')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async listFlags(@Request() req: any) {
    const orgId = req.headers['x-org-id'];
    return this.flagsService.findAll(orgId);
  }

  @Get('flags/:key')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async getFlag(@Param('key') key: string) {
    return this.flagsService.findOne(key);
  }

  @Patch('flags/:key/toggle')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async toggleFlag(@Param('key') key: string, @Request() req: any) {
    return this.flagsService.toggle(key, req.user?.id);
  }

  @Post('flags/:key/kill')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async killFlag(@Param('key') key: string, @Request() req: any) {
    await this.flagsService.kill(key, req.user?.id);
    return { message: `Feature flag ${key} has been killed` };
  }

  @Get('flags/:key/audit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async getFlagAudit(@Param('key') key: string) {
    return this.flagsService.getAudit(key);
  }

  // ===== E49-s1: Maintenance Windows =====

  @Post('maintenance')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async createMaintenanceWindow(@Body() body: any, @Request() req: any) {
    return this.maintenanceService.create({
      orgId: body.orgId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      message: body.message,
      blockWrites: body.blockWrites,
      createdById: req.user?.id,
    });
  }

  @Get('maintenance/active')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async getActiveMaintenanceWindows(@Request() req: any) {
    const orgId = req.headers['x-org-id'];
    return this.maintenanceService.getActive(orgId);
  }

  @Get('maintenance')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L5')
  async listMaintenanceWindows(@Request() req: any) {
    const orgId = req.headers['x-org-id'];
    return this.maintenanceService.findAll(orgId);
  }
}
