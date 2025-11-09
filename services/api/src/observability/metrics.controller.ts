import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('/metrics')
  async get(@Res() res: Response) {
    const body = await this.metrics.metrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(body);
  }
}
