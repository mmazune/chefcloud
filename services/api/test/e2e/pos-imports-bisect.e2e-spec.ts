import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { EfrisModule } from '../../src/efris/efris.module';
import { EventsModule } from '../../src/events/events.module';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { KpisModule } from '../../src/kpis/kpis.module';
import { PromotionsModule } from '../../src/promotions/promotions.module';
import { AccountingModule } from '../../src/accounting/accounting.module';
import { ConfigModule } from '@nestjs/config';
import { cleanup } from '../helpers/cleanup';

describe('PosModule imports bisect', () => {
  it('should test all PosModule imports together', async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [
        EfrisModule,
        ConfigModule,
        EventsModule,
        InventoryModule,
        KpisModule,
        PromotionsModule,
        AccountingModule,
      ],
    });
    await moduleRef.init();
    await moduleRef.close();
  });
});
