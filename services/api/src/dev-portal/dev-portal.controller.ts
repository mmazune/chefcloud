import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { DevPortalService } from './dev-portal.service';
import { DevAdminGuard } from './guards/dev-admin.guard';
import { SuperDevGuard } from './guards/super-dev.guard';

@Controller('dev')
@UseGuards(DevAdminGuard)
export class DevPortalController {
  constructor(private devPortalService: DevPortalService) {}

  @Post('orgs')
  @HttpCode(201)
  async createOrg(
    @Body()
    body: {
      ownerEmail: string;
      orgName: string;
      planCode: string;
    },
  ) {
    return this.devPortalService.createOrg(body);
  }

  @Get('subscriptions')
  async listSubscriptions() {
    return this.devPortalService.listSubscriptions();
  }

  @Post('plans')
  @UseGuards(SuperDevGuard)
  async upsertPlan(
    @Body()
    body: {
      code: string;
      name: string;
      priceUGX: number;
      features: any;
      isActive?: boolean;
    },
  ) {
    return this.devPortalService.upsertPlan(body);
  }

  @Post('superdevs')
  @UseGuards(SuperDevGuard)
  async manageDevAdmin(
    @Body() body: { action: 'add' | 'remove'; email: string; isSuper?: boolean },
  ) {
    return this.devPortalService.manageDevAdmin(
      body.action,
      body.email,
      body.isSuper,
    );
  }
}
