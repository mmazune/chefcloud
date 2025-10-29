/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BadgesService } from './badges.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('badges')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BadgesController {
  constructor(private badgesService: BadgesService) {}

  @Post('register')
  @Roles('L4')
  async register(@Req() req: any, @Body() body: { code: string }): Promise<any> {
    return this.badgesService.register(req.user.orgId, body.code);
  }

  @Post('assign')
  @Roles('L4')
  async assign(@Req() req: any, @Body() body: { code: string; userId: string }): Promise<any> {
    return this.badgesService.assign(body.code, body.userId, req.user.id);
  }

  @Post('revoke')
  @Roles('L4')
  async revoke(@Body() body: { code: string; reason: string }): Promise<any> {
    return this.badgesService.revoke(body.code, body.reason);
  }

  @Post('report-lost')
  @Roles('L4')
  async reportLost(@Body() body: { code: string }): Promise<any> {
    return this.badgesService.reportLost(body.code);
  }

  @Post('mark-returned')
  @Roles('L4')
  async markReturned(@Req() req: any, @Body() body: { code: string }): Promise<any> {
    return this.badgesService.markReturned(body.code, req.user.id);
  }

  @Get()
  @Roles('L4')
  async list(@Req() req: any): Promise<any[]> {
    return this.badgesService.list(req.user.orgId);
  }
}
