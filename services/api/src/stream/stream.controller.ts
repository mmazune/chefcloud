import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventBusService } from '../events/event-bus.service';

const KEEPALIVE_INTERVAL = parseInt(process.env.STREAM_KEEPALIVE_SEC || '15', 10) * 1000;

@Controller('stream')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StreamController {
  constructor(private readonly eventBus: EventBusService) {}

  /**
   * SSE endpoint for spout events (live pour monitoring).
   * Requires L3+ authentication.
   * Sends keepalive ping every 15s.
   * Throttles events to 1 per second per device.
   */
  @Get('spout')
  @Roles('L3', 'L4', 'L5')
  streamSpout(@Query('deviceId') deviceId: string, @Res() res: Response, @Req() req: Request) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    this.eventBus.incrementClientCount();

    // Keepalive ping
    const keepaliveTimer = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, KEEPALIVE_INTERVAL);

    // Subscribe to spout events
    const subscription = this.eventBus.subscribe('spout', deviceId).subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      },
      error: (err) => {
        console.error('SSE spout stream error:', err);
        cleanup();
      },
    });

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(keepaliveTimer);
      subscription.unsubscribe();
      this.eventBus.decrementClientCount();
      res.end();
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }

  /**
   * SSE endpoint for KDS events (kitchen display updates).
   * Requires L3+ authentication.
   * Sends keepalive ping every 15s.
   * Supports station filter via ?station=GRILL|FRYER|BAR
   */
  @Get('kds')
  @Roles('L3', 'L4', 'L5')
  streamKds(@Query('station') station: string, @Res() res: Response, @Req() req: Request) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    this.eventBus.incrementClientCount();

    // Keepalive ping
    const keepaliveTimer = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, KEEPALIVE_INTERVAL);

    // Subscribe to KDS events
    const subscription = this.eventBus.subscribe('kds').subscribe({
      next: (event) => {
        // Filter by station if provided
        if (station && event.data.station !== station) {
          return;
        }
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      },
      error: (err) => {
        console.error('SSE kds stream error:', err);
        cleanup();
      },
    });

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(keepaliveTimer);
      subscription.unsubscribe();
      this.eventBus.decrementClientCount();
      res.end();
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }
}
