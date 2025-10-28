/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OpsService } from './ops.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateApiKeyDto {
  name!: string;
  scopes!: string[];
}

@Controller('ops')
export class OpsController {
  constructor(private opsService: OpsService) {}

  @Get('health')
  async getHealth() {
    return this.opsService.getHealthStatus();
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
}
