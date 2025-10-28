/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Body, UseGuards, Get, Query, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from './support.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class IngestEventDto {
  token!: string;
  eventType!: string;
  data: any;
}

@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('sessions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async createSession(@Req() req: any) {
    return this.supportService.createSession(req.user.userId, req.user.orgId);
  }

  @Post('ingest')
  async ingestEvent(@Body() dto: IngestEventDto) {
    return this.supportService.ingestEvent(dto.token, dto.eventType, dto.data);
  }

  @Get('sessions/events')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async getSessionEvents(@Query('sessionId') sessionId: string) {
    return this.supportService.getSessionEvents(sessionId);
  }
}
