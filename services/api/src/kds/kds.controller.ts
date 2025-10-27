import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KdsService } from './kds.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('kds')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KdsController {
  constructor(private kdsService: KdsService) {}

  @Get('queue')
  @Roles('L1')
  async getQueue(@Query('station') station: string): Promise<unknown> {
    return this.kdsService.getQueue(station);
  }

  @Post('tickets/:id/mark-ready')
  @Roles('L1')
  async markReady(@Param('id') ticketId: string): Promise<unknown> {
    return this.kdsService.markReady(ticketId);
  }

  @Post('tickets/:id/recall')
  @Roles('L1')
  async recallTicket(@Param('id') ticketId: string): Promise<unknown> {
    return this.kdsService.recallTicket(ticketId);
  }
}
