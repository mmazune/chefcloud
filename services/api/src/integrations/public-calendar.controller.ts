/**
 * M9.5: Public Calendar Controller
 *
 * Public ICS calendar feed endpoint.
 * Token-based access with CALENDAR_READ scope.
 */
import { Controller, Get, Query, Param, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { IcsService } from './ics.service';

@ApiTags('Public Calendar')
@Controller('public/reservations')
export class PublicCalendarController {
  private readonly logger = new Logger(PublicCalendarController.name);

  constructor(private icsService: IcsService) { }

  @Get(':branchSlug/calendar.ics')
  @ApiOperation({ summary: 'Get ICS calendar feed for reservations' })
  async getCalendarFeed(
    @Param('branchSlug') branchSlug: string,
    @Query('token') token: string,
    @Query('days') daysParam?: string,
    @Res() res?: Response,
  ) {
    // Validate token and get branch
    const branch = await this.icsService.validateFeedToken(token);

    // Calculate date range (default: next 30 days)
    const days = Math.min(parseInt(daysParam || '30', 10), 90);
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    // Get reservations as ICS events
    const events = await this.icsService.getReservationsAsICS(branch.id, from, to);

    // Generate ICS content
    const icsContent = this.icsService.generateICSContent(events, branch.name);

    this.logger.log(`Generated ICS feed for branch ${branch.id} with ${events.length} events`);

    // Send response
    if (res) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${branch.name}-reservations.ics"`);
      res.send(icsContent);
    }

    return icsContent;
  }
}
