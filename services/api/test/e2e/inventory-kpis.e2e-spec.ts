import './_injector-patch';
import 'reflect-metadata';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { KpisModule } from '../../src/kpis/kpis.module';
import { cleanup } from '../helpers/cleanup';

describe('InventoryModule + KpisModule test', () => {
  it('should compile these modules together', async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [InventoryModule, KpisModule],
    });
    await moduleRef.init();
    await moduleRef.close();
  });
});
