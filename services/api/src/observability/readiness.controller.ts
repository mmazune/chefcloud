import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReadinessService } from './readiness.service';

@Controller()
export class HealthController {
  constructor(private readonly svc: ReadinessService) {}

  @Get('/healthz')
  async liveness(@Res() res: Response) {
    res.status(200).json({ status: 'ok' });
  }

  @Get('/readiness')
  async readiness(@Res() res: Response) {
    const r = await this.svc.check();
    res.status(r.ok ? 200 : 503).json({ status: r.ok ? 'ok' : 'degraded', ...r });
  }
}
