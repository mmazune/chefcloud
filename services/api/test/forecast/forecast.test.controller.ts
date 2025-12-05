import { Controller, Get, Post, Query, Res, HttpCode, Req } from '@nestjs/common';
import type { Response } from 'express';
import { getCache, setCache, clearCache, computeForecast } from './forecast.cache';

@Controller('forecast-test')
export class ForecastTestController {
  @Get('sales')
  async sales(@Query('period') period: string, @Res({ passthrough: true }) res: Response, @Req() req: any) {
    if (req.__TEST_RATE_LIMIT_HIT__) {
      res.status(429);
      return { statusCode: 429, message: 'Too Many Requests' };
    }
    if (!/^\d{4}-\d{2}$/.test(period ?? '')) {
      res.status(400);
      return { error: 'period must be YYYY-MM' };
    }
    const key = `forecast:${period}`;
    const cached = getCache<any>(key);
    if (cached) { res.set('x-cache', 'HIT'); return cached; }
    const fresh = computeForecast(period);
    setCache(key, fresh, 60_000); // 60s TTL
    res.set('x-cache', 'MISS');
    return fresh;
  }

  @Post('invalidate')
  @HttpCode(200)
  invalidate(@Query('prefix') prefix?: string, @Req() req?: any) {
    if (req?.__TEST_RATE_LIMIT_HIT__) {
      return { statusCode: 429, message: 'Too Many Requests' };
    }
    clearCache(prefix ?? 'forecast:');
    return { ok: true };
  }
}
