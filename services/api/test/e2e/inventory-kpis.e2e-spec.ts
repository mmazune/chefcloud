import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { KpisModule } from '../../src/kpis/kpis.module';

describe('InventoryModule + KpisModule test', () => {
  it('should compile these modules together', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InventoryModule, KpisModule],
    }).compile();
    await moduleRef.init();
    await moduleRef.close();
  });
});
