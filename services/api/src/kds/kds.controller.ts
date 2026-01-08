import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { KdsService } from './kds.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GetKdsQueueDto, UpdateKdsSlaConfigDto, VoidTicketDto } from './dto/kds-ticket.dto';

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

  // ===== M13.3: KDS Board + Ticket Lifecycle =====

  /**
   * M13.3: Get KDS board for a branch/station with branch isolation
   */
  @Get('board')
  @Roles('L2')
  @ApiOperation({ summary: 'Get KDS board with tickets by station and status' })
  async getBoard(
    @Request() req: { user: { branchId: string; orgId: string } },
    @Query('stationId') stationId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    return this.kdsService.getBoard(req.user.orgId, req.user.branchId, stationId, status);
  }

  /**
   * M13.3: Start working on a ticket (QUEUED → IN_PROGRESS)
   */
  @Post('tickets/:id/start')
  @Roles('L2')
  @ApiOperation({ summary: 'Start ticket (QUEUED → IN_PROGRESS)' })
  async startTicket(
    @Param('id') ticketId: string,
    @Request() req: { user: { branchId: string; orgId: string; userId: string } },
  ): Promise<unknown> {
    return this.kdsService.startTicket(ticketId, req.user.orgId, req.user.branchId, req.user.userId);
  }

  /**
   * M13.3: Mark ticket ready (IN_PROGRESS → READY)
   */
  @Post('tickets/:id/ready')
  @Roles('L2')
  @ApiOperation({ summary: 'Mark ticket ready (IN_PROGRESS → READY)' })
  async readyTicket(
    @Param('id') ticketId: string,
    @Request() req: { user: { branchId: string; orgId: string; userId: string } },
  ): Promise<unknown> {
    return this.kdsService.readyTicket(ticketId, req.user.orgId, req.user.branchId, req.user.userId);
  }

  /**
   * M13.3: Mark ticket done (READY → DONE)
   */
  @Post('tickets/:id/done')
  @Roles('L2')
  @ApiOperation({ summary: 'Mark ticket done (READY → DONE)' })
  async doneTicket(
    @Param('id') ticketId: string,
    @Request() req: { user: { branchId: string; orgId: string; userId: string } },
  ): Promise<unknown> {
    return this.kdsService.doneTicket(ticketId, req.user.orgId, req.user.branchId, req.user.userId);
  }

  /**
   * M13.3: Void ticket (any state → VOID, L4+ only)
   */
  @Post('tickets/:id/void')
  @Roles('L4')
  @ApiOperation({ summary: 'Void ticket (L4+ only, requires reason)' })
  async voidTicket(
    @Param('id') ticketId: string,
    @Body() dto: VoidTicketDto,
    @Request() req: { user: { branchId: string; orgId: string; userId: string } },
  ): Promise<unknown> {
    return this.kdsService.voidTicket(ticketId, dto.reason, req.user.orgId, req.user.branchId, req.user.userId);
  }

  /**
   * M13.3: Export tickets to CSV
   */
  @Get('export/tickets.csv')
  @Roles('L4')
  @ApiOperation({ summary: 'Export tickets as CSV' })
  async exportTickets(
    @Request() req: { user: { orgId: string; branchId?: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('stationId') stationId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const { csv, hash } = await this.kdsService.exportTicketsCsv(
      req.user.orgId,
      branchId ?? req.user.branchId,
      from,
      to,
      stationId,
    );

    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"');
    res?.setHeader('X-Nimbus-Export-Hash', hash);
    res?.send(csv);
  }
}
