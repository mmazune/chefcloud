import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CacheInvalidationService } from '../../src/common/cache-invalidation.service';
import { clearCache } from '../forecast/forecast.cache';

type TransferChanged = {
  id: string;
  type: 'transfer.changed';
  data: { from: string; to: string; sku: string; qty: number; at: string };
};

@Controller('transfer-test')
export class TransferEventsTestController {
  constructor(private readonly inv: CacheInvalidationService) {}

  @Post('event')
  @HttpCode(200)
  async handle(@Body() body: TransferChanged | any) {
    if (!body?.type || body.type !== 'transfer.changed' || !body?.data) {
      return { ok: false, reason: 'invalid_payload' };
    }

    // Franchise invalidations (E22.D)
    await Promise.allSettled([
      this.inv.invalidatePrefix?.('franchise:overview'),
      this.inv.invalidatePrefix?.('franchise:rankings'),
      this.inv.invalidatePrefix?.('franchise:budgets'),
    ]);

    // Forecast invalidation (test scope)
    clearCache('forecast:');

    return { ok: true, invalidated: ['franchise:overview', 'franchise:rankings', 'franchise:budgets', 'forecast:*'] };
  }
}
