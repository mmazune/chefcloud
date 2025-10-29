import { Controller, Post, Get, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface RequestWithUser extends Request {
  user?: {
    sub: string;
    email: string;
    orgId: string;
    role: string;
    id: string;
  };
}

@Controller('promotions')
@UseGuards(AuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @Post()
  @Roles('L4', 'L5')
  async create(@Request() req: RequestWithUser, @Body() dto: any): Promise<any> {
    const orgId = req.user!.orgId;
    return this.promotionsService.create(orgId, dto);
  }

  @Get()
  @Roles('L4', 'L5')
  async list(
    @Request() req: RequestWithUser,
    @Query('active') active?: string,
    @Query('code') code?: string,
  ): Promise<any> {
    const orgId = req.user!.orgId;
    const filters: any = {};

    if (active !== undefined) {
      filters.active = active === 'true';
    }

    if (code) {
      filters.code = code;
    }

    return this.promotionsService.list(orgId, filters);
  }

  @Post(':id/approve')
  @Roles('L4', 'L5')
  async approve(@Request() req: RequestWithUser, @Param('id') id: string): Promise<any> {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    return this.promotionsService.approve(orgId, id, userId);
  }

  @Post(':id/toggle')
  @Roles('L4', 'L5')
  async toggle(@Request() req: RequestWithUser, @Param('id') id: string, @Body() body: { active: boolean }): Promise<any> {
    const orgId = req.user!.orgId;
    return this.promotionsService.toggle(orgId, id, body.active);
  }
}
