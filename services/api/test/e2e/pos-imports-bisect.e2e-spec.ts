import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { EfrisModule } from '../../src/efris/efris.module';
import { EventsModule } from '../../src/events/events.module';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { KpisModule } from '../../src/kpis/kpis.module';
import { PromotionsModule } from '../../src/promotions/promotions.module';
import { AccountingModule } from '../../src/accounting/accounting.module';
import { ConfigModule } from '@nestjs/config';

describe('PosModule imports bisect', () => {
  it('should test all PosModule imports together', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EfrisModule,
        ConfigModule,
        EventsModule,
        InventoryModule,
        KpisModule,
        PromotionsModule,
        AccountingModule,
      ],
    }).compile();
    await moduleRef.init();
    await moduleRef.close();
  });
});
