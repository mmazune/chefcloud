import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KdsService } from './kds.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GetKdsQueueDto, UpdateKdsSlaConfigDto } from './dto/kds-ticket.dto';

@ApiTags('KDS')
@ApiBearerAuth('bearer')
@Controller('kds')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KdsController {
  constructor(private kdsService: KdsService) {}

  /**
   * M1-KDS: Enhanced queue endpoint with waiter names, SLA states, and "since" parameter
   */
  @Get('queue')
  @Roles('L1')
  @ApiOperation({
    summary: 'Get KDS queue for a station',
    description:
      'Returns active tickets for a station with waiter names, SLA states, and proper ordering. Supports incremental sync via "since" parameter.',
  })
  @ApiResponse({ status: 200, description: 'Array of KDS tickets with waiter info and SLA state' })
  async getQueue(@Query() dto: GetKdsQueueDto): Promise<any[]> {
    return this.kdsService.getQueue(dto.station, dto.since);
  }

  /**
   * M1-KDS: Get SLA configuration for a station
   */
  @Get('sla-config/:station')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({
    summary: 'Get SLA configuration for a station',
    description: 'Returns the SLA thresholds for green/orange/red colour coding.',
  })
  @ApiResponse({ status: 200, description: 'SLA configuration' })
  async getSlaConfig(@Request() req: any, @Param('station') station: string): Promise<any> {
    return this.kdsService.getSlaConfig(req.user.orgId, station);
  }

  /**
   * M1-KDS: Update SLA configuration (Manager/Owner only)
   */
  @Patch('sla-config/:station')
  @Roles('L4', 'L5')
  @ApiOperation({
    summary: 'Update SLA configuration for a station',
    description: 'Manager/Owner can update SLA thresholds for colour coding.',
  })
  @ApiResponse({ status: 200, description: 'Updated SLA configuration' })
  async updateSlaConfig(
    @Request() req: any,
    @Param('station') station: string,
    @Body() dto: UpdateKdsSlaConfigDto,
  ): Promise<any> {
    return this.kdsService.updateSlaConfig(req.user.orgId, station, dto);
  }

  @Post('tickets/:id/mark-ready')
  @Roles('L1')
  @ApiOperation({ summary: 'Mark a ticket as ready' })
  async markReady(@Param('id') ticketId: string): Promise<unknown> {
    return this.kdsService.markReady(ticketId);
  }

  @Post('tickets/:id/recall')
  @Roles('L1')
  @ApiOperation({ summary: 'Recall a ticket (bump back to queue)' })
  async recallTicket(@Param('id') ticketId: string): Promise<unknown> {
    return this.kdsService.recallTicket(ticketId);
  }
}
